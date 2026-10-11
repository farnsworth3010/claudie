package server_test

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"claudie/daemon/internal/core"
	"claudie/daemon/internal/eventlog"
	"claudie/daemon/internal/server"
)

const (
	clockMs  = 1_700_000_000_000 // the clock of the test servers: 2023-11-14T22:13:20Z
	patience = 5 * time.Second   // how long to wait for something that must happen
)

// syncBuffer is a buffer the event log can write to while a test reads it.
type syncBuffer struct {
	mu  sync.Mutex
	buf bytes.Buffer
}

func (b *syncBuffer) Write(p []byte) (int, error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.buf.Write(p)
}

func (b *syncBuffer) String() string {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.buf.String()
}

// env is a server running on a test port, with a fixed clock and an event log.
type env struct {
	url  string
	port string
	core *core.Core
	log  *syncBuffer
	stop func() error // ends the server and returns what Serve returned
}

// start runs a server on a free port until the test ends; mods change its options first.
func start(t *testing.T, mods ...func(*server.Options)) *env {
	t.Helper()
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	c, err := core.New()
	if err != nil {
		t.Fatal(err)
	}
	port := strconv.Itoa(ln.Addr().(*net.TCPAddr).Port)
	e := &env{url: "http://127.0.0.1:" + port, port: port, core: c, log: &syncBuffer{}}
	opts := server.Options{
		Engine:   c,
		Hosts:    []string{"127.0.0.1:" + port, "localhost:" + port},
		EventLog: eventlog.New(e.log),
		Now:      func() time.Time { return time.UnixMilli(clockMs) },
	}
	for _, mod := range mods {
		mod(&opts)
	}

	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error, 1)
	go func() { done <- server.New(opts).Serve(ctx, ln) }()
	var once sync.Once
	var serveErr error
	e.stop = func() error {
		once.Do(func() {
			cancel()
			select {
			case serveErr = <-done:
			case <-time.After(patience):
				t.Error("the server did not stop")
			}
		})
		return serveErr
	}
	t.Cleanup(func() { _ = e.stop() })
	return e
}

// eventually waits until cond holds.
func eventually(t *testing.T, what string, cond func() bool) {
	t.Helper()
	for deadline := time.Now().Add(patience); !cond(); time.Sleep(5 * time.Millisecond) {
		if time.Now().After(deadline) {
			t.Fatalf("gave up waiting for %s", what)
		}
	}
}

// postHook sends one event and returns the status.
func postHook(t *testing.T, e *env, body, pid string) int {
	t.Helper()
	req, err := http.NewRequest(http.MethodPost, e.url+"/hook", strings.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Content-Type", "application/json")
	if pid != "" {
		req.Header.Set("X-Claudie-Pid", pid)
	}
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	res.Body.Close()
	return res.StatusCode
}

// snapshot is the part of the daemon's snapshot the tests look at.
type snapshot struct {
	Now      int64 `json:"now"`
	Sessions []struct {
		ID       string `json:"id"`
		Pid      int    `json:"pid"`
		Activity string `json:"activity"`
		Mood     string `json:"mood"`
		Leaving  *int64 `json:"leavingAt"`
	} `json:"sessions"`
}

// decode reads a snapshot from its JSON.
func decode(t *testing.T, raw string) snapshot {
	t.Helper()
	var snap snapshot
	if err := json.Unmarshal([]byte(raw), &snap); err != nil {
		t.Fatalf("snapshot %q: %v", raw, err)
	}
	return snap
}

// getState fetches the snapshot from /state.
func getState(t *testing.T, e *env) snapshot {
	t.Helper()
	res, err := http.Get(e.url + "/state")
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	var snap snapshot
	if err := json.NewDecoder(res.Body).Decode(&snap); err != nil {
		t.Fatal(err)
	}
	return snap
}

// postSettings sends a settings patch and returns the status and body.
func postSettings(t *testing.T, e *env, body string) (int, string) {
	t.Helper()
	res, err := http.Post(e.url+"/settings", "application/json", strings.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	out, _ := io.ReadAll(res.Body)
	return res.StatusCode, string(out)
}

// stream is an open /events connection; its state events arrive on events.
type stream struct {
	header http.Header
	events chan string // the data of each event
}

// openStream connects to /events and reads it in the background until the test ends.
func openStream(t *testing.T, e *env) *stream {
	t.Helper()
	res, err := http.Get(e.url + "/events")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { res.Body.Close() })
	s := &stream{header: res.Header, events: make(chan string, 64)}
	go func() {
		defer close(s.events)
		r := bufio.NewReader(res.Body)
		for {
			line, err := r.ReadString('\n')
			if err != nil {
				return
			}
			if data, ok := strings.CutPrefix(line, "data: "); ok {
				s.events <- strings.TrimSpace(data)
			}
		}
	}()
	return s
}

// next is the data of the next event.
func (s *stream) next(t *testing.T) string {
	t.Helper()
	select {
	case data, ok := <-s.events:
		if !ok {
			t.Fatal("the stream ended")
		}
		return data
	case <-time.After(patience):
		t.Fatal("no event arrived")
		return ""
	}
}

// quiet checks that no event arrives within d.
func (s *stream) quiet(t *testing.T, d time.Duration) {
	t.Helper()
	select {
	case data := <-s.events:
		t.Errorf("unexpected event %s", data)
	case <-time.After(d):
	}
}
