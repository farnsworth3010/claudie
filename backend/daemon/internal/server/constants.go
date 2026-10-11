package server

import "time"

// Requests.
const (
	maxBody   = 1 << 20
	pidHeader = "X-Claudie-Pid"
	// The same event twice within this is one event sent by two copies of the hooks.
	repeatWindow = 2 * time.Second
)

// Connections.
const (
	heartbeat         = 15 * time.Second // SSE comment that keeps idle connections open
	readHeaderTimeout = 5 * time.Second  // no write timeout: SSE streams live for hours
	idleTimeout       = 2 * time.Minute
	shutdownTimeout   = 5 * time.Second
)

// Wire format.
const (
	mimeJSON        = "application/json"
	mimeEventStream = "text/event-stream"
	eventState      = "state" // the SSE event that carries a snapshot
)
