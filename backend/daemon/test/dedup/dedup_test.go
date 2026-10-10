package dedup_test

import (
	"testing"
	"time"

	"claudie/daemon/internal/dedup"
)

func TestRepeatsAreRecognisedWithinTheWindow(t *testing.T) {
	w := dedup.New(2 * time.Second)
	t0 := time.UnixMilli(1_000_000)
	event := []byte(`{"hook_event_name":"Stop","session_id":"s1"}`)
	steps := []struct {
		name string
		body []byte
		pid  int
		at   time.Duration
		want bool
	}{
		{"first", event, 0, 0, false},
		{"the same again", event, 0, 10 * time.Millisecond, true},
		{"from another pid", event, 7, 20 * time.Millisecond, false},
		{"another event", []byte(`{"hook_event_name":"Stop","session_id":"s2"}`), 0, 30 * time.Millisecond, false},
		{"after the window", event, 0, 3 * time.Second, false},
	}
	for _, step := range steps {
		if got := w.Repeat(step.body, step.pid, t0.Add(step.at)); got != step.want {
			t.Errorf("%s: repeat %v, want %v", step.name, got, step.want)
		}
	}
}
