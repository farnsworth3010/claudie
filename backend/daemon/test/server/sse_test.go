package server_test

import (
	"testing"
)

func TestEventsStreamTheStateOnConnectAndOnChange(t *testing.T) {
	e := start(t)
	events := openStream(t, e)
	if ct := events.header.Get("Content-Type"); ct != "text/event-stream" {
		t.Fatalf("Content-Type %q", ct)
	}
	if first := decode(t, events.next(t)); len(first.Sessions) != 0 {
		t.Fatalf("first snapshot %+v, want no sessions", first)
	}
	postHook(t, e, `{"hook_event_name":"UserPromptSubmit","session_id":"s1"}`, "")
	if next := decode(t, events.next(t)); len(next.Sessions) != 1 || next.Sessions[0].Activity != "thinking" {
		t.Fatalf("snapshot after the hook %+v", next)
	}
}

func TestEventsReachEveryClient(t *testing.T) {
	e := start(t)
	a, b := openStream(t, e), openStream(t, e)
	a.next(t)
	b.next(t)
	postHook(t, e, `{"hook_event_name":"UserPromptSubmit","session_id":"s1"}`, "")
	for name, s := range map[string]*stream{"a": a, "b": b} {
		if got := decode(t, s.next(t)); len(got.Sessions) != 1 {
			t.Errorf("client %s got %+v, want the new session", name, got)
		}
	}
}
