package main

import (
	"bufio"
	"bytes"
	"encoding/json"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"
)

// startServer runs the daemon's handler on a test port, with a fixed clock and an event log.
func startServer(t *testing.T) (*httptest.Server, *bytes.Buffer) {
	t.Helper()
	c, err := newCore()
	if err != nil {
		t.Fatal(err)
	}
	var buf bytes.Buffer
	srv := httptest.NewUnstartedServer(nil)
	port := srv.Listener.Addr().(*net.TCPAddr).Port
	s := newServer(c, &eventLog{out: &buf}, port)
	s.now = func() time.Time { return time.UnixMilli(1_700_000_000_000) }
	srv.Config.Handler = s.handler()
	srv.Start()
	t.Cleanup(srv.Close)
	return srv, &buf
}

func postHook(t *testing.T, srv *httptest.Server, body, pid string) int {
	t.Helper()
	req, _ := http.NewRequest(http.MethodPost, srv.URL+"/hook", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	if pid != "" {
		req.Header.Set("X-Claudie-Pid", pid)
	}
	res, err := srv.Client().Do(req)
	if err != nil {
		t.Fatal(err)
	}
	res.Body.Close()
	return res.StatusCode
}

type snapshot struct {
	Now      int64 `json:"now"`
	Sessions []struct {
		ID       string `json:"id"`
		Pid      int    `json:"pid"`
		Activity string `json:"activity"`
	} `json:"sessions"`
}

func TestHookUpdatesTheState(t *testing.T) {
	srv, log := startServer(t)
	if code := postHook(t, srv, `{"hook_event_name":"SessionStart","session_id":"s1","cwd":"/p/demo"}`, "4242"); code != http.StatusNoContent {
		t.Fatalf("SessionStart: status %d, want 204", code)
	}
	postHook(t, srv, `{"hook_event_name":"UserPromptSubmit","session_id":"s1"}`, "")

	res, err := srv.Client().Get(srv.URL + "/state")
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	var snap snapshot
	if err := json.NewDecoder(res.Body).Decode(&snap); err != nil {
		t.Fatal(err)
	}
	if snap.Now != 1_700_000_000_000 || len(snap.Sessions) != 1 {
		t.Fatalf("snapshot %+v", snap)
	}
	if s := snap.Sessions[0]; s.ID != "s1" || s.Pid != 4242 || s.Activity != "thinking" {
		t.Errorf("session %+v, want s1, pid 4242, thinking", s)
	}
	if lines := strings.Count(log.String(), "\n"); lines != 2 {
		t.Errorf("event log has %d lines, want 2", lines)
	}
}

func TestEventsStreamTheStateOnConnectAndOnChange(t *testing.T) {
	srv, _ := startServer(t)
	res, err := srv.Client().Get(srv.URL + "/events")
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	if ct := res.Header.Get("Content-Type"); ct != "text/event-stream" {
		t.Fatalf("Content-Type %q", ct)
	}
	events := bufio.NewReader(res.Body)
	if first := readEvent(t, events); len(first.Sessions) != 0 {
		t.Fatalf("first snapshot %+v, want no sessions", first)
	}
	postHook(t, srv, `{"hook_event_name":"UserPromptSubmit","session_id":"s1"}`, "")
	if next := readEvent(t, events); len(next.Sessions) != 1 || next.Sessions[0].Activity != "thinking" {
		t.Fatalf("snapshot after the hook %+v", next)
	}
}

// readEvent reads one "event: state" block and decodes its data line.
func readEvent(t *testing.T, r *bufio.Reader) snapshot {
	t.Helper()
	var snap snapshot
	for {
		line, err := r.ReadString('\n')
		if err != nil {
			t.Fatal(err)
		}
		if data, ok := strings.CutPrefix(line, "data: "); ok {
			if err := json.Unmarshal([]byte(data), &snap); err != nil {
				t.Fatal(err)
			}
			return snap
		}
	}
}

func TestGuardTurnsAwayWebPages(t *testing.T) {
	srv, _ := startServer(t)
	send := func(method, path, contentType string, header map[string]string) int {
		req, _ := http.NewRequest(method, srv.URL+path, strings.NewReader(`{"hook_event_name":"Stop","session_id":"s1"}`))
		if contentType != "" {
			req.Header.Set("Content-Type", contentType)
		}
		for k, v := range header {
			if k == "Host" {
				req.Host = v
			} else {
				req.Header.Set(k, v)
			}
		}
		res, err := srv.Client().Do(req)
		if err != nil {
			t.Fatal(err)
		}
		io.Copy(io.Discard, res.Body)
		res.Body.Close()
		return res.StatusCode
	}
	port := strconv.Itoa(srv.Listener.Addr().(*net.TCPAddr).Port)
	cases := []struct {
		name   string
		method string
		path   string
		ct     string
		header map[string]string
		want   int
	}{
		{"foreign Host (DNS rebinding)", "GET", "/state", "", map[string]string{"Host": "evil.example:" + port}, http.StatusForbidden},
		{"foreign Origin", "POST", "/hook", "application/json", map[string]string{"Origin": "https://evil.example"}, http.StatusForbidden},
		{"form post", "POST", "/hook", "text/plain", nil, http.StatusUnsupportedMediaType},
		{"localhost is fine", "GET", "/state", "", map[string]string{"Host": "localhost:" + port}, http.StatusOK},
		{"own origin is fine", "POST", "/hook", "application/json", map[string]string{"Origin": "http://127.0.0.1:" + port}, http.StatusNoContent},
		{"wrong method", "GET", "/hook", "", nil, http.StatusMethodNotAllowed},
	}
	for _, tc := range cases {
		if got := send(tc.method, tc.path, tc.ct, tc.header); got != tc.want {
			t.Errorf("%s: status %d, want %d", tc.name, got, tc.want)
		}
	}
}

func TestHookRejectsBadBodies(t *testing.T) {
	srv, log := startServer(t)
	if code := postHook(t, srv, `not json`, ""); code != http.StatusBadRequest {
		t.Errorf("bad JSON: status %d, want 400", code)
	}
	if code := postHook(t, srv, `{"a":"`+strings.Repeat("x", maxBody)+`"}`, ""); code != http.StatusBadRequest {
		t.Errorf("oversized body: status %d, want 400", code)
	}
	if log.Len() != 0 {
		t.Errorf("rejected requests were logged: %q", log.String())
	}
}
