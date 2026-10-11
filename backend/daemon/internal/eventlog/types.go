package eventlog

import (
	"encoding/json"
	"io"
	"sync"
)

// Record is one received hook event: what the core gets, and a line of the event log.
type Record struct {
	Received int64           `json:"received"` // ms since the epoch, when the daemon got it
	Pid      int             `json:"pid,omitempty"`
	Event    json.RawMessage `json:"event"`
}

// Log appends records as JSON lines; requests arrive concurrently, so writes are serialized.
type Log struct {
	mu  sync.Mutex
	out io.Writer
}
