package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"slices"
	"strconv"
	"strings"
	"sync"
	"time"
)

const (
	maxBody   = 1 << 20
	heartbeat = 15 * time.Second
)

// server takes hook events in and streams session snapshots out:
//
//	POST /hook    a Claude Code event as the body; the pid in X-Claudie-Pid when the sender knows it
//	GET  /state   the current snapshot
//	GET  /events  server-sent events: the snapshot on connect and after every change
type server struct {
	core  *core
	log   *eventLog // nil: no event log
	now   func() time.Time
	hosts []string // the Host values we answer to

	mu      sync.Mutex
	clients map[chan string]struct{}
}

func newServer(c *core, log *eventLog, port int) *server {
	return &server{
		core:    c,
		log:     log,
		now:     time.Now,
		hosts:   []string{fmt.Sprintf("127.0.0.1:%d", port), fmt.Sprintf("localhost:%d", port)},
		clients: map[chan string]struct{}{},
	}
}

func (s *server) handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("POST /hook", s.hook)
	mux.HandleFunc("GET /state", s.state)
	mux.HandleFunc("GET /events", s.events)
	return s.guard(mux)
}

// guard turns away web pages: any site can make the browser send requests to localhost. A
// foreign Host means DNS rebinding, a foreign Origin a cross-site request; and requiring JSON
// on POST forces a CORS preflight, which we never answer.
func (s *server) guard(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if !slices.Contains(s.hosts, r.Host) || (origin != "" && !slices.Contains(s.hosts, strings.TrimPrefix(strings.TrimPrefix(origin, "http://"), "https://"))) {
			w.WriteHeader(http.StatusForbidden)
			return
		}
		if r.Method == http.MethodPost && !strings.HasPrefix(r.Header.Get("Content-Type"), "application/json") {
			w.WriteHeader(http.StatusUnsupportedMediaType)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (s *server) hook(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, maxBody))
	if err != nil || !json.Valid(body) {
		w.WriteHeader(http.StatusBadRequest)
		return
	}
	pid, _ := strconv.Atoi(r.Header.Get("X-Claudie-Pid"))
	line, _ := json.Marshal(record{Received: s.now().UnixMilli(), Pid: pid, Event: body})
	if s.log != nil {
		if err := s.log.write(line); err != nil {
			fmt.Println("claudie-daemon: event log:", err)
		}
	}
	changed, err := s.core.hook(line)
	if err != nil {
		fmt.Println("claudie-daemon: hook:", err)
		w.WriteHeader(http.StatusInternalServerError)
		return
	}
	if changed {
		s.broadcast()
	}
	// An empty 2xx is what Claude Code's http hooks read as "carry on".
	w.WriteHeader(http.StatusNoContent)
}

func (s *server) state(w http.ResponseWriter, _ *http.Request) {
	snap, err := s.core.snapshot(s.now())
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	io.WriteString(w, snap)
}

func (s *server) events(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		w.WriteHeader(http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")

	// One pending snapshot per client is enough: each one holds the whole state.
	updates := make(chan string, 1)
	s.mu.Lock()
	s.clients[updates] = struct{}{}
	s.mu.Unlock()
	defer func() {
		s.mu.Lock()
		delete(s.clients, updates)
		s.mu.Unlock()
	}()

	if snap, err := s.core.snapshot(s.now()); err == nil {
		fmt.Fprintf(w, "event: state\ndata: %s\n\n", snap)
		flusher.Flush()
	}
	ping := time.NewTicker(heartbeat)
	defer ping.Stop()
	for {
		select {
		case <-r.Context().Done():
			return
		case snap := <-updates:
			fmt.Fprintf(w, "event: state\ndata: %s\n\n", snap)
		case <-ping.C:
			// Keeps idle connections from being dropped and notices clients that went away.
			io.WriteString(w, ": ping\n\n")
		}
		flusher.Flush()
	}
}

// broadcast sends the new snapshot to every client, replacing one it hasn't taken yet.
func (s *server) broadcast() {
	snap, err := s.core.snapshot(s.now())
	if err != nil {
		fmt.Println("claudie-daemon: snapshot:", err)
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	for c := range s.clients {
		select {
		case <-c:
		default:
		}
		c <- snap
	}
}
