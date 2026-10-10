package main

import (
	"encoding/json"
	"io"
	"sync"
)

// record is one received hook event: what the core gets, and a line of the event log.
type record struct {
	Received int64           `json:"received"` // ms since the epoch, when the daemon got it
	Pid      int             `json:"pid,omitempty"`
	Event    json.RawMessage `json:"event"`
}

// eventLog appends records as JSON lines; requests arrive concurrently, so writes are serialized.
type eventLog struct {
	mu  sync.Mutex
	out io.Writer
}

func (l *eventLog) write(line []byte) error {
	l.mu.Lock()
	defer l.mu.Unlock()
	_, err := l.out.Write(append(line, '\n'))
	return err
}
