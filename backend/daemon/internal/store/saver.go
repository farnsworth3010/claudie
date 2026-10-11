package store

import (
	"fmt"
	"log/slog"
	"time"
)

// NewSaver returns a saver of src's sessions into the file at path, at most once per every.
func NewSaver(src SessionSource, path string, every time.Duration) *Saver {
	return &Saver{src: src, path: path, every: every}
}

// Touch notes that the sessions changed.
func (s *Saver) Touch() {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.stopped || s.timer != nil {
		return
	}
	s.timer = time.AfterFunc(s.every, s.fire)
}

// fire is the timer's write.
func (s *Saver) fire() {
	s.mu.Lock()
	s.timer = nil
	s.mu.Unlock()
	if err := s.Flush(); err != nil {
		slog.Error("save sessions", "err", err)
	}
}

// Flush writes the sessions now.
func (s *Saver) Flush() error {
	s.flushMu.Lock()
	defer s.flushMu.Unlock()
	data, err := s.src.Save()
	if err != nil {
		return fmt.Errorf("collect sessions: %w", err)
	}
	return WriteFileAtomic(s.path, []byte(data))
}

// Stop cancels the pending write and writes the sessions one last time, so a shutdown loses
// nothing. Later touches do nothing.
func (s *Saver) Stop() error {
	s.mu.Lock()
	s.stopped = true
	if s.timer != nil {
		s.timer.Stop()
		s.timer = nil
	}
	s.mu.Unlock()
	return s.Flush()
}
