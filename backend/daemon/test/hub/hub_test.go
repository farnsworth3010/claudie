package hub_test

import (
	"errors"
	"slices"
	"strconv"
	"sync"
	"sync/atomic"
	"testing"

	"claudie/daemon/internal/hub"
)

// constant is a snapshot function that always yields snap.
func constant(snap string) func() (string, error) {
	return func() (string, error) { return snap, nil }
}

func TestHubKeepsOnlyTheLatestSnapshotPerClient(t *testing.T) {
	h := hub.New()
	slow, cancelSlow := h.Subscribe(nil)
	gone, cancelGone := h.Subscribe(nil)
	cancelGone()

	for _, snap := range []string{"one", "two"} {
		if err := h.Publish(constant(snap)); err != nil {
			t.Fatal(err)
		}
	}
	if got := <-slow; got != "two" {
		t.Errorf("a slow client got %q, want the latest, two", got)
	}
	if len(gone) != 0 {
		t.Error("a cancelled client was sent a snapshot")
	}
	cancelSlow()
	if err := h.Publish(constant("three")); err != nil { // nobody is left: must not block
		t.Fatal(err)
	}
}

func TestHubQueuesTheSnapshotOfTheMomentAsTheFirst(t *testing.T) {
	h := hub.New()
	updates, cancel := h.Subscribe(constant("now"))
	defer cancel()
	if got := <-updates; got != "now" {
		t.Errorf("first snapshot %q, want now", got)
	}
}

func TestHubPublishReportsASnapshotThatFails(t *testing.T) {
	h := hub.New()
	updates, cancel := h.Subscribe(nil)
	defer cancel()
	if err := h.Publish(func() (string, error) { return "", errors.New("boom") }); err == nil {
		t.Error("a failed snapshot was not reported")
	}
	if len(updates) != 0 {
		t.Error("a failed snapshot was sent")
	}
}

// Every snapshot is a number that only grows, read where the state is read; a client must
// never see one smaller than the one before, whichever publish gets the lock first.
func TestHubDeliversSnapshotsInTheOrderTheStateWasRead(t *testing.T) {
	h := hub.New()
	var counter atomic.Int64
	next := func() (string, error) { return strconv.FormatInt(counter.Add(1), 10), nil }

	updates, cancel := h.Subscribe(next)
	defer cancel()
	received := make(chan []int64)
	stop := make(chan struct{})
	go func() {
		var seen []int64
		take := func(snap string) {
			n, _ := strconv.ParseInt(snap, 10, 64)
			seen = append(seen, n)
		}
		for {
			select {
			case snap := <-updates:
				take(snap)
			case <-stop:
				// Whatever is still pending is the latest one.
				select {
				case snap := <-updates:
					take(snap)
				default:
				}
				received <- seen
				return
			}
		}
	}()

	var wg sync.WaitGroup
	for range 50 {
		wg.Go(func() {
			for range 50 {
				if err := h.Publish(next); err != nil {
					t.Error(err)
				}
			}
		})
	}
	wg.Wait()
	close(stop)

	seen := <-received
	if !slices.IsSorted(seen) {
		t.Errorf("snapshots arrived out of order: %v", seen)
	}
	if last := seen[len(seen)-1]; last != counter.Load() {
		t.Errorf("the last snapshot is %d, want the latest, %d", last, counter.Load())
	}
}
