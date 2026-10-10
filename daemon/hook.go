package main

import (
	"encoding/json"
	"io"
	"net/http"
	"strconv"
	"sync"
	"time"
)

const maxBody = 1 << 20

// record is one received hook event as written to the event log, one JSON object per line.
type record struct {
	Received int64           `json:"received"` // ms since the epoch, when the daemon got it
	Pid      int             `json:"pid,omitempty"`
	Event    json.RawMessage `json:"event"`
}

// eventLog appends records to every writer; requests arrive concurrently, so writes are serialized.
type eventLog struct {
	mu  sync.Mutex
	out []io.Writer
	now func() time.Time
}

func (l *eventLog) write(r record) error {
	line, err := json.Marshal(r)
	if err != nil {
		return err
	}
	line = append(line, '\n')
	l.mu.Lock()
	defer l.mu.Unlock()
	for _, w := range l.out {
		if _, err := w.Write(line); err != nil {
			return err
		}
	}
	return nil
}

// ServeHTTP takes POST /hook: the Claude Code event as the body, and the claude process id in
// X-Claudie-Pid when the sender knows it (only the SessionStart command hook does).
func (l *eventLog) ServeHTTP(w http.ResponseWriter, req *http.Request) {
	if req.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	body, err := io.ReadAll(http.MaxBytesReader(w, req.Body, maxBody))
	if err != nil || !json.Valid(body) {
		w.WriteHeader(http.StatusBadRequest)
		return
	}
	pid, _ := strconv.Atoi(req.Header.Get("X-Claudie-Pid"))
	if err := l.write(record{Received: l.now().UnixMilli(), Pid: pid, Event: body}); err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		return
	}
	// An empty 2xx is what Claude Code's http hooks read as "carry on".
	w.WriteHeader(http.StatusNoContent)
}
