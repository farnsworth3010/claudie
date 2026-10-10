package server_test

import (
	"io"
	"net/http"
	"strings"
	"testing"
)

func TestGuardTurnsAwayWebPages(t *testing.T) {
	e := start(t)
	send := func(method, path, contentType string, header map[string]string) int {
		req, err := http.NewRequest(method, e.url+path, strings.NewReader(`{"hook_event_name":"Stop","session_id":"s1"}`))
		if err != nil {
			t.Fatal(err)
		}
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
		res, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		_, _ = io.Copy(io.Discard, res.Body) // the body is of no interest, only that it is drained
		res.Body.Close()
		return res.StatusCode
	}
	tests := []struct {
		name   string
		method string
		path   string
		ct     string
		header map[string]string
		want   int
	}{
		{"foreign Host (DNS rebinding)", "GET", "/state", "", map[string]string{"Host": "evil.example:" + e.port}, http.StatusForbidden},
		{"foreign Origin", "POST", "/hook", "application/json", map[string]string{"Origin": "https://evil.example"}, http.StatusForbidden},
		{"form post", "POST", "/hook", "text/plain", nil, http.StatusUnsupportedMediaType},
		{"localhost is fine", "GET", "/state", "", map[string]string{"Host": "localhost:" + e.port}, http.StatusOK},
		{"own origin is fine", "POST", "/hook", "application/json", map[string]string{"Origin": "http://127.0.0.1:" + e.port}, http.StatusNoContent},
		{"wrong method", "DELETE", "/hook", "", nil, http.StatusMethodNotAllowed},
		{"the page", "GET", "/", "", nil, http.StatusOK},
		{"the page to a foreign Host", "GET", "/", "", map[string]string{"Host": "evil.example:" + e.port}, http.StatusForbidden},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := send(tt.method, tt.path, tt.ct, tt.header); got != tt.want {
				t.Errorf("status %d, want %d", got, tt.want)
			}
		})
	}
}
