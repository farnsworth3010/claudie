// Package dedup recognises an event that arrives twice: hooks configured both by the plugin and by
// hand send every event twice, at once and byte for byte the same.
package dedup

import (
	"crypto/sha256"
	"strconv"
	"sync"
	"time"
)

// Window remembers what it saw for a while; safe for concurrent use.
type Window struct {
	ttl  time.Duration
	mu   sync.Mutex
	seen map[[sha256.Size]byte]time.Time
}

// New returns a window that forgets what it saw after ttl.
func New(ttl time.Duration) *Window {
	return &Window{ttl: ttl, seen: map[[sha256.Size]byte]time.Time{}}
}

// Repeat reports whether the same body from the same pid was seen less than ttl before now,
// and remembers this one.
func (w *Window) Repeat(body []byte, pid int, now time.Time) bool {
	key := sha256.Sum256(append([]byte(strconv.Itoa(pid)+"\n"), body...))
	w.mu.Lock()
	defer w.mu.Unlock()
	for k, at := range w.seen {
		if now.Sub(at) >= w.ttl {
			delete(w.seen, k)
		}
	}
	if _, ok := w.seen[key]; ok {
		return true
	}
	w.seen[key] = now
	return false
}
