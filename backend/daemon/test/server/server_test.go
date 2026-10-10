package server_test

import (
	"context"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"claudie/daemon/internal/core"
	"claudie/daemon/internal/server"
	"claudie/daemon/internal/store"
)

func TestServeShutsDownCleanlyAndSavesTheSessions(t *testing.T) {
	path := filepath.Join(t.TempDir(), "sessions.json")
	e := start(t, func(o *server.Options) {
		// An hour between writes: only the final one can put the file there.
		o.Saver = store.NewSaver(o.Engine.(store.SessionSource), path, time.Hour)
	})
	events := openStream(t, e) // an open stream must not hold the shutdown up
	events.next(t)
	postHook(t, e, `{"hook_event_name":"UserPromptSubmit","session_id":"s1"}`, "")
	if _, err := os.Stat(path); err == nil {
		t.Fatal("written before the shutdown")
	}

	if err := e.stop(); err != nil {
		t.Fatalf("Serve: %v", err)
	}
	if data, err := os.ReadFile(path); err != nil || !strings.Contains(string(data), `"s1"`) {
		t.Errorf("sessions file %q, %v; want the session saved on shutdown", data, err)
	}
}

func TestChangesAreSavedWithinTheInterval(t *testing.T) {
	path := filepath.Join(t.TempDir(), "sessions.json")
	e := start(t, func(o *server.Options) {
		o.Saver = store.NewSaver(o.Engine.(store.SessionSource), path, 20*time.Millisecond)
	})
	postHook(t, e, `{"hook_event_name":"UserPromptSubmit","session_id":"s1"}`, "")
	eventually(t, "the sessions file", func() bool {
		data, err := os.ReadFile(path)
		return err == nil && strings.Contains(string(data), `"thinking"`)
	})
}

func TestServeReportsAListenerThatFails(t *testing.T) {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	ln.Close()
	c, err := core.New()
	if err != nil {
		t.Fatal(err)
	}
	if err := server.New(server.Options{Engine: c}).Serve(context.Background(), ln); err == nil {
		t.Error("a closed listener was served without an error")
	}
}

// pids is a process check whose answer the test decides, and which remembers what it was asked.
type pids struct {
	mu    sync.Mutex
	alive bool
	asked []int
}

func (p *pids) check(pid int) bool {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.asked = append(p.asked, pid)
	return p.alive
}

func (p *pids) set(alive bool) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.alive = alive
}

func (p *pids) askedAbout(pid int) bool {
	p.mu.Lock()
	defer p.mu.Unlock()
	for _, asked := range p.asked {
		if asked == pid {
			return true
		}
	}
	return false
}

func TestLivenessLetsGoOfSessionsWhoseProcessIsGone(t *testing.T) {
	p := &pids{alive: true}
	e := start(t, func(o *server.Options) {
		o.Alive = p.check
		o.LivenessEvery = 10 * time.Millisecond
	})
	postHook(t, e, `{"hook_event_name":"SessionStart","session_id":"s1"}`, "4242")
	events := openStream(t, e)
	events.next(t)

	eventually(t, "a check of the process", func() bool { return p.askedAbout(4242) })
	if got := getState(t, e).Sessions[0].Leaving; got != nil {
		t.Fatalf("a live process: leaving %v", *got)
	}

	p.set(false)
	if got := decode(t, events.next(t)); got.Sessions[0].Leaving == nil {
		t.Errorf("the departure was broadcast as %+v, want a leaving session", got)
	}
	if getState(t, e).Sessions[0].Leaving == nil {
		t.Error("the session of a dead process didn't leave")
	}
}

func TestTranscriptLinesChangeTheStateAndAreBroadcast(t *testing.T) {
	e := start(t, func(o *server.Options) { o.TranscriptEvery = 10 * time.Millisecond })
	path := filepath.Join(t.TempDir(), "s1.jsonl")
	if err := os.WriteFile(path, []byte("{}\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	postHook(t, e, `{"hook_event_name":"SessionStart","session_id":"s1","transcript_path":"`+path+`"}`, "")
	postHook(t, e, `{"hook_event_name":"UserPromptSubmit","session_id":"s1"}`, "")
	events := openStream(t, e)
	events.next(t)

	// The test server's clock stands at 2023-11-14T22:13:20Z; this line came after it.
	line := `{"type":"user","timestamp":"2023-11-14T22:13:30Z","message":{"role":"user","content":"[Request interrupted by user]"}}`
	f, err := os.OpenFile(path, os.O_WRONLY|os.O_APPEND, 0o600)
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	if _, err := f.WriteString(line + "\n"); err != nil {
		t.Fatal(err)
	}
	got := decode(t, events.next(t))
	if len(got.Sessions) != 1 || got.Sessions[0].Activity != "idle" || got.Sessions[0].Mood != "interrupted" {
		t.Errorf("broadcast %+v, want idle/interrupted", got)
	}
}

func TestStreamsEndWhenTheServerStops(t *testing.T) {
	e := start(t)
	events := openStream(t, e)
	events.next(t)
	if err := e.stop(); err != nil {
		t.Fatal(err)
	}
	select {
	case _, ok := <-events.events:
		if ok {
			t.Error("an event arrived after the stop")
		}
	case <-time.After(patience):
		t.Error("the stream stayed open after the stop")
	}
}

func TestRequestsAfterTheStopAreRefused(t *testing.T) {
	e := start(t)
	if err := e.stop(); err != nil {
		t.Fatal(err)
	}
	if res, err := http.Get(e.url + "/state"); err == nil {
		res.Body.Close()
		t.Error("a stopped server answered")
	}
}
