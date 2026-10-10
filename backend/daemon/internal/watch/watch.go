// Package watch runs what happens on a timer: the ticker helper and the transcript tailer.
package watch

import (
	"context"
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
