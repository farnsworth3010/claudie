package server_test

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"claudie/daemon/internal/server"
)

func TestHookUpdatesTheState(t *testing.T) {
	e := start(t)
	if code := postHook(t, e, `{"hook_event_name":"SessionStart","session_id":"s1","cwd":"/p/demo"}`, "4242"); code != http.StatusNoContent {
		t.Fatalf("SessionStart: status %d, want 204", code)
	}
	postHook(t, e, `{"hook_event_name":"UserPromptSubmit","session_id":"s1"}`, "")

	snap := getState(t, e)
	if snap.Now != clockMs || len(snap.Sessions) != 1 {
		t.Fatalf("snapshot %+v", snap)
	}
	if s := snap.Sessions[0]; s.ID != "s1" || s.Pid != 4242 || s.Activity != "thinking" {
		t.Errorf("session %+v, want s1, pid 4242, thinking", s)
	}
	if lines := strings.Count(e.log.String(), "\n"); lines != 2 {
		t.Errorf("event log has %d lines, want 2", lines)
	}
}

func TestHookRejectsBadBodies(t *testing.T) {
	e := start(t)
	if code := postHook(t, e, `not json`, ""); code != http.StatusBadRequest {
		t.Errorf("bad JSON: status %d, want 400", code)
	}
	if code := postHook(t, e, `{"a":"`+strings.Repeat("x", 1<<20)+`"}`, ""); code != http.StatusBadRequest {
		t.Errorf("oversized body: status %d, want 400", code)
	}
	if e.log.String() != "" {
		t.Errorf("rejected requests were logged: %q", e.log.String())
	}
}

func TestSettingsAreReadAndChanged(t *testing.T) {
	path := filepath.Join(t.TempDir(), "claudie", "settings.json")
	e := start(t, func(o *server.Options) { o.SettingsPath = path })
	events := openStream(t, e)
	events.next(t) // the state on connect

	res, err := http.Get(e.url + "/settings")
	if err != nil {
		t.Fatal(err)
	}
	var got struct{ Size int }
	_ = json.NewDecoder(res.Body).Decode(&got) // a bad body leaves Size zero, which fails below
	res.Body.Close()
	if res.StatusCode != http.StatusOK || got.Size != 4 {
		t.Fatalf("GET: status %d, settings %+v, want 200 and the default size 4", res.StatusCode, got)
	}

	code, body := postSettings(t, e, `{"size":6}`)
	if code != http.StatusOK || !strings.Contains(body, `"size":6`) {
		t.Fatalf("POST: status %d, body %s, want 200 and size 6", code, body)
	}
	if saved, err := os.ReadFile(path); err != nil || string(saved) != body {
		t.Errorf("settings file %q, %v; want %q", saved, err, body)
	}
	if snap := events.next(t); !strings.Contains(snap, `"size":6`) {
		t.Errorf("broadcast %s lacks the new size", snap)
	}

	// The same patch again changes nothing: no broadcast, no write.
	if err := os.Remove(path); err != nil {
		t.Fatal(err)
	}
	if code, _ := postSettings(t, e, `{"size":6}`); code != http.StatusOK {
		t.Errorf("repeated POST: status %d, want 200", code)
	}
	if _, err := os.Stat(path); err == nil {
		t.Error("an unchanged settings file was written again")
	}
	events.quiet(t, 100*time.Millisecond)
}

func TestSettingsRejectBadPatches(t *testing.T) {
	e := start(t)
	for name, body := range map[string]string{
		"not JSON":      `{"size":`,
		"unknown field": `{"colour":"red"}`,
		"wrong type":    `{"size":"big"}`,
		"not an object": `[1]`,
		"oversized":     `{"x":"` + strings.Repeat("x", 1<<20) + `"}`,
	} {
		if code, _ := postSettings(t, e, body); code != http.StatusBadRequest {
			t.Errorf("%s: status %d, want 400", name, code)
		}
	}
}

func TestAnEventSentTwiceCountsOnce(t *testing.T) {
	e := start(t)
	body := `{"hook_event_name":"UserPromptSubmit","session_id":"s1","cwd":"/p/demo"}`
	for range 2 {
		if code := postHook(t, e, body, ""); code != http.StatusNoContent {
			t.Fatalf("status %d, want 204", code)
		}
	}
	if lines := strings.Count(e.log.String(), "\n"); lines != 1 {
		t.Errorf("event log has %d lines, want 1: the copy is dropped before anything else", lines)
	}
}
