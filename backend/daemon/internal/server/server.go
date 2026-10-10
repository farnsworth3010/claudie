// Package server takes hook events in and streams session snapshots out over HTTP.
package server

import (
	"cmp"
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"time"

	"claudie/daemon/internal/hub"
	"claudie/daemon/internal/proc"
	"claudie/daemon/internal/watch"
)

// New returns a server of the sessions in o.Engine.
func New(o Options) *Server {
	s := &Server{
		core:            o.Engine,
		log:             o.EventLog,
		hosts:           o.Hosts,
		saver:           o.Saver,
		settingsPath:    o.SettingsPath,
		now:             time.Now,
		alive:           proc.Alive,
		livenessEvery:   cmp.Or(o.LivenessEvery, watch.LivenessEvery),
		transcriptEvery: cmp.Or(o.TranscriptEvery, watch.TranscriptEvery),
		tailer:          watch.NewTailer(o.Engine),
		hub:             hub.New(),
	}
	if o.Now != nil {
		s.now = o.Now
	}
	if o.Alive != nil {
		s.alive = o.Alive
	}
	return s
}

// handler routes the requests, behind the guard.
func (s *Server) handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("POST /hook", s.hook)
	mux.HandleFunc("GET /state", s.state)
	mux.HandleFunc("GET /events", s.events)
	mux.HandleFunc("GET /settings", s.getSettings)
	mux.HandleFunc("POST /settings", s.postSettings)
	return s.guard(mux)
}

// Serve answers on ln until ctx ends, then stops cleanly: open requests finish, the timers
// stop, and the sessions are written one last time.
func (s *Server) Serve(ctx context.Context, ln net.Listener) error {
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()
	s.startTimers(ctx)
	defer s.finish(cancel)

	httpSrv := &http.Server{
		Handler:           s.handler(),
		ReadHeaderTimeout: readHeaderTimeout,
		IdleTimeout:       idleTimeout,
		BaseContext:       func(net.Listener) context.Context { return ctx }, // ends the event streams on shutdown
	}
	failed := make(chan error, 1)
	go func() { failed <- httpSrv.Serve(ln) }()

	select {
	case err := <-failed:
		return fmt.Errorf("serve: %w", err)
	case <-ctx.Done():
	}
	slog.Info("stopping")
	shutdownCtx, stop := context.WithTimeout(context.WithoutCancel(ctx), shutdownTimeout)
	defer stop()
	if err := httpSrv.Shutdown(shutdownCtx); err != nil {
		slog.Warn("shutdown", "err", err)
		_ = httpSrv.Close() // past the grace period: drop what is left
	}
	if err := <-failed; !errors.Is(err, http.ErrServerClosed) {
		return fmt.Errorf("serve: %w", err)
	}
	return nil
}

// startTimers runs the liveness check and the transcript reader until ctx ends.
func (s *Server) startTimers(ctx context.Context) {
	s.timers.Go(func() { watch.Every(ctx, s.livenessEvery, s.checkLiveness) })
	s.timers.Go(func() { watch.Every(ctx, s.transcriptEvery, s.readTranscripts) })
}

// finish stops the timers and writes the sessions, last of all so that nothing changes them after.
func (s *Server) finish(cancel context.CancelFunc) {
	cancel()
	s.timers.Wait()
	if s.saver == nil {
		return
	}
	if err := s.saver.Stop(); err != nil {
		slog.Error("save sessions", "err", err)
	}
}

// checkLiveness lets go of the sessions whose process is gone.
func (s *Server) checkLiveness() {
	changed, err := s.core.Tick(s.now(), s.alive)
	if err != nil {
		slog.Error("check liveness", "err", err)
		return
	}
	if changed {
		s.changed()
	}
}

// readTranscripts feeds the engine what the transcripts gained.
func (s *Server) readTranscripts() {
	if s.tailer.Step() {
		s.changed()
	}
}

// changed is what every change of the state, whatever its source, ends in.
func (s *Server) changed() {
	s.broadcast()
	if s.saver != nil {
		s.saver.Touch()
	}
}

// snapshot is the state now, stamped with the server's clock.
func (s *Server) snapshot() (string, error) {
	return s.core.Snapshot(s.now())
}

// broadcast sends the new snapshot to every client.
func (s *Server) broadcast() {
	if err := s.hub.Publish(s.snapshot); err != nil {
		slog.Error("snapshot", "err", err)
	}
}
