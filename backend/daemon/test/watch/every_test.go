package watch_test

import (
	"context"
	"sync/atomic"
	"testing"
	"time"

	"claudie/daemon/internal/watch"
)

func TestEveryCallsFnUntilTheContextEnds(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	var calls atomic.Int32
	done := make(chan struct{})
	go func() {
		defer close(done)
		watch.Every(ctx, time.Millisecond, func() {
			if calls.Add(1) == 3 {
				cancel()
			}
		})
	}()
	select {
	case <-done:
	case <-time.After(5 * time.Second):
		t.Fatal("Every did not return after the context ended")
	}
	if calls.Load() < 3 {
		t.Errorf("fn called %d times, want at least 3", calls.Load())
	}
}
