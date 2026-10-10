package server

import (
	"sync"
	"time"

	"claudie/daemon/internal/eventlog"
	"claudie/daemon/internal/hub"
	"claudie/daemon/internal/store"
	"claudie/daemon/internal/watch"
)

// Engine is the session logic the server drives; *core.Core implements it.
type Engine interface {
	watch.Source
	// Hook applies one received event; it reports whether any session changed.
	Hook(envelope []byte) (bool, error)
	// Snapshot is every session as JSON, stamped with now.
	Snapshot(now time.Time) (string, error)
	// Tick ages sessions and lets go of those whose process is gone; alive must not call the engine.
	Tick(now time.Time, alive func(pid int) bool) (bool, error)
	// Settings is the current settings as JSON.
	Settings() (string, error)
	// UpdateSettings applies a client's patch; ok is false when the patch is refused.
	UpdateSettings(patch string) (settings string, ok bool, err error)
}

// Options is what a server is made of.
type Options struct {
	Engine       Engine
	Hosts        []string      // the Host header values to answer to
	EventLog     *eventlog.Log // nil: no event log
	Saver        *store.Saver  // nil: sessions aren't kept across restarts
	SettingsPath string        // "": settings aren't kept across restarts

	// Zero values mean the real clock, process check and timer intervals.
	Now             func() time.Time
	Alive           func(pid int) bool
	LivenessEvery   time.Duration
	TranscriptEvery time.Duration
}

// Server takes hook events in and streams session snapshots out:
//
//	POST /hook      a Claude Code event as the body; the pid in X-Claudie-Pid when the sender knows it
//	GET  /state     the current snapshot
//	GET  /events    server-sent events: the snapshot on connect and after every change
//	GET  /settings  the overlay settings
//	POST /settings  a JSON patch of them, answered with the settings after it
//
// Its timers (liveness, transcripts) run while Serve does.
type Server struct {
	core         Engine
	log          *eventlog.Log
	hosts        []string
	saver        *store.Saver
	settingsPath string

	now             func() time.Time
	alive           func(pid int) bool
	livenessEvery   time.Duration
	transcriptEvery time.Duration
	tailer          *watch.Tailer

	settingsMu sync.Mutex // one settings change at a time, file included
	hub        *hub.Hub
	timers     sync.WaitGroup
}
