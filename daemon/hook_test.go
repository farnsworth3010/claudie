package main

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func newTestLog() (*eventLog, *bytes.Buffer) {
	var buf bytes.Buffer
	at := time.UnixMilli(1_700_000_000_000)
	return &eventLog{out: []io.Writer{&buf}, now: func() time.Time { return at }}, &buf
}

func post(h http.Handler, body string, pid string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodPost, "/hook", strings.NewReader(body))
	if pid != "" {
		req.Header.Set("X-Claudie-Pid", pid)
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func TestHookLogsTheEventWithTimeAndPid(t *testing.T) {
	log, buf := newTestLog()
	event := `{"hook_event_name":"SessionStart","session_id":"s1"}`

	if rec := post(log, event, "4242"); rec.Code != http.StatusNoContent {
		t.Fatalf("status %d, want 204", rec.Code)
	}
	var got record
	if err := json.Unmarshal(buf.Bytes(), &got); err != nil {
		t.Fatalf("log line %q: %v", buf.String(), err)
	}
	if got.Received != 1_700_000_000_000 || got.Pid != 4242 || string(got.Event) != event {
		t.Errorf("logged %+v (event %s)", got, got.Event)
	}
}

func TestHookWithoutPidOmitsIt(t *testing.T) {
	log, buf := newTestLog()
	post(log, `{"hook_event_name":"Stop"}`, "")
	if strings.Contains(buf.String(), `"pid"`) {
		t.Errorf("log line %q has a pid", buf.String())
	}
}

func TestHookRejectsBadRequests(t *testing.T) {
	log, buf := newTestLog()
	if rec := post(log, `not json`, ""); rec.Code != http.StatusBadRequest {
		t.Errorf("bad JSON: status %d, want 400", rec.Code)
	}
	if rec := post(log, `{"a":"`+strings.Repeat("x", maxBody)+`"}`, ""); rec.Code != http.StatusBadRequest {
		t.Errorf("oversized body: status %d, want 400", rec.Code)
	}
	rec := httptest.NewRecorder()
	log.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/hook", nil))
	if rec.Code != http.StatusMethodNotAllowed {
		t.Errorf("GET: status %d, want 405", rec.Code)
	}
	if buf.Len() != 0 {
		t.Errorf("rejected requests were logged: %q", buf.String())
	}
}
