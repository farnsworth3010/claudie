package store

import (
	"sync"
	"time"
)

// SessionSource is where the saver gets the sessions to write; *core.Core implements it.
type SessionSource interface {
	// Save is the sessions to keep across restarts, as JSON.
	Save() (string, error)
}

// Persistable is what Open restores from the files; *core.Core implements it.
type Persistable interface {
	SessionSource
	// Restore gives back what Save returned.
	Restore(saved string) error
	// LoadSettings hands over the settings file's JSON; "null" when there is none.
	LoadSettings(raw string) error
}

// Files is what Open found: the saver of the sessions and the settings file's path.
// A field is zero when its file can't be located, which costs persistence only.
type Files struct {
	Saver        *Saver
	SettingsPath string
}

// Saver writes the sessions to disk. A streaming transcript changes them all the time, so
// Touch only arms a timer: that is at most one write per interval, never postponed by new changes.
type Saver struct {
	src   SessionSource
	path  string
	every time.Duration

	flushMu sync.Mutex // an older snapshot must never land over a newer one

	mu      sync.Mutex
	timer   *time.Timer // non-nil while a write is pending
	stopped bool
}
