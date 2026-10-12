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

func TestEveryWhileRestsUntilWokenWithWorkToDo(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	var busy atomic.Bool
	calls := make(chan struct{}, 100)
	w := watch.NewWaker()
	done := make(chan struct{})
	go func() {
		defer close(done)
		watch.EveryWhile(ctx, time.Millisecond, func() { calls <- struct{}{} }, busy.Load, w)
	}()
	select {
	case <-calls:
		t.Fatal("fn ran with nothing to do")
	case <-time.After(50 * time.Millisecond):
	}
	busy.Store(true)
	w.Wake()
	select {
	case <-calls:
	case <-time.After(5 * time.Second):
		t.Fatal("fn did not run once woken with work to do")
	}
	busy.Store(false)
	time.Sleep(20 * time.Millisecond) // lets a tick already under way finish
	for len(calls) > 0 {
		<-calls
	}
	select {
	case <-calls:
		t.Fatal("fn kept running after the work was gone")
	case <-time.After(50 * time.Millisecond):
	}
	cancel()
	select {
	case <-done:
	case <-time.After(5 * time.Second):
		t.Fatal("EveryWhile did not return after the context ended")
	}
}
