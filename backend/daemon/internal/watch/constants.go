package watch

import "time"

// Timers.
const (
	LivenessEvery   = 5 * time.Second
	TranscriptEvery = 400 * time.Millisecond
)

// Transcript reading.
const (
	// A file seen for the first time is read from this far before its end: recent history
	// still says how full the context is and what the session was last doing.
	startBytes = 1 << 20
	maxChunk   = 4 << 20
)
