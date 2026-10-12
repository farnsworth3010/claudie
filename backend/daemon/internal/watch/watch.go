// Package watch runs what happens on a timer: the ticker helper and the transcript tailer.
package watch

import (
	"context"
	"sync"
	"time"
)

// Every calls fn on a ticker until ctx ends; a slow fn makes the ticker drop ticks, so calls
// never overlap.
func Every(ctx context.Context, d time.Duration, fn func()) {
	t := time.NewTicker(d)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			fn()
		}
	}
}

// EveryWhile is Every that rests while busy reports false: no ticker runs then, until w wakes it
// and busy says there is work again.
func EveryWhile(ctx context.Context, d time.Duration, fn func(), busy func() bool, w *Waker) {
	for {
		woken := w.wait() // taken before asking busy, so a wake in between isn't missed
		if !busy() {
			select {
			case <-ctx.Done():
				return
			case <-woken:
				continue
			}
		}
		t := time.NewTicker(d)
		for busy() {
			select {
			case <-ctx.Done():
				t.Stop()
				return
			case <-t.C:
				fn()
			}
		}
		t.Stop()
	}
}

// Waker wakes everything resting in EveryWhile on it at once.
type Waker struct {
	mu sync.Mutex
	ch chan struct{}
}

func NewWaker() *Waker {
	return &Waker{ch: make(chan struct{})}
}

func (w *Waker) Wake() {
	w.mu.Lock()
	defer w.mu.Unlock()
	close(w.ch)
	w.ch = make(chan struct{})
}

func (w *Waker) wait() <-chan struct{} {
	w.mu.Lock()
	defer w.mu.Unlock()
	return w.ch
}
