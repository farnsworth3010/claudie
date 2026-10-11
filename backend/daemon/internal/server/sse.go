package server

import (
	"fmt"
	"io"
	"net/http"
	"time"
)

// events streams the snapshot on connect and after every change, until the client leaves or
// the server stops.
func (s *Server) events(w http.ResponseWriter, r *http.Request) {
	rc := http.NewResponseController(w)
	w.Header().Set("Content-Type", mimeEventStream)
	w.Header().Set("Cache-Control", "no-cache")

	updates, cancel := s.hub.Subscribe(s.snapshot) // its first snapshot is the state on connect
	defer cancel()

	ping := time.NewTicker(heartbeat)
	defer ping.Stop()
	for {
		var err error
		select {
		case <-r.Context().Done():
			return
		case snap := <-updates:
			err = writeEvent(w, rc, snap)
		case <-ping.C:
			// Keeps idle connections from being dropped and notices clients that went away.
			_, err = io.WriteString(w, ": ping\n\n")
			if err == nil {
				err = rc.Flush()
			}
		}
		if err != nil {
			return
		}
	}
}

// writeEvent sends one state event and flushes it to the client.
func writeEvent(w io.Writer, rc *http.ResponseController, snap string) error {
	if _, err := fmt.Fprintf(w, "event: %s\ndata: %s\n\n", eventState, snap); err != nil {
		return err
	}
	return rc.Flush()
}
