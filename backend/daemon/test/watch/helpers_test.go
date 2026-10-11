package watch_test

import (
	"encoding/json"
	"os"
	"testing"
	"time"

	"claudie/daemon/internal/core"
)

// The clock of these tests stands at 2023-11-14T22:13:20Z; a line stamped later than a hook came after it.
const (
	clockMs         = 1_700_000_000_000
	interruptedLine = `{"type":"user","timestamp":"2023-11-14T22:13:30Z","message":{"role":"user","content":"[Request interrupted by user]"}}`
	padLine         = `{"type":"summary","pad":"` + "................................................................................" + `"}`
)

// newCore returns a core with no sessions.
func newCore(t *testing.T) *core.Core {
	t.Helper()
	c, err := core.New()
	if err != nil {
		t.Fatal(err)
	}
	return c
}

// hook sends the core one event, as the daemon would wrap it.
func hook(t *testing.T, c *core.Core, event string) {
	t.Helper()
	line, err := json.Marshal(map[string]any{"received": clockMs, "event": json.RawMessage(event)})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := c.Hook(line); err != nil {
		t.Fatal(err)
	}
}

// sessionWithTranscript starts a thinking session whose transcript is the file at path.
func sessionWithTranscript(t *testing.T, c *core.Core, path string) {
	t.Helper()
	hook(t, c, `{"hook_event_name":"SessionStart","session_id":"s1","transcript_path":"`+path+`"}`)
	hook(t, c, `{"hook_event_name":"UserPromptSubmit","session_id":"s1"}`)
}

// appendTo adds text to the end of a file, creating it.
func appendTo(t *testing.T, path, text string) {
	t.Helper()
	f, err := os.OpenFile(path, os.O_WRONLY|os.O_APPEND|os.O_CREATE, 0o600)
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	if _, err := f.WriteString(text); err != nil {
		t.Fatal(err)
	}
}

// activityOf is the one session's activity and mood, as activity/mood.
func activityOf(t *testing.T, c *core.Core) string {
	t.Helper()
	snap, err := c.Snapshot(time.UnixMilli(clockMs))
	if err != nil {
		t.Fatal(err)
	}
	var s struct {
		Sessions []struct{ Activity, Mood string }
	}
	if err := json.Unmarshal([]byte(snap), &s); err != nil {
		t.Fatal(err)
	}
	if len(s.Sessions) != 1 {
		t.Fatalf("snapshot %s, want one session", snap)
	}
	return s.Sessions[0].Activity + "/" + s.Sessions[0].Mood
}

// fakeSource lists the transcripts it is told to and records the lines it is fed.
type fakeSource struct {
	refs  []core.TranscriptRef
	lines []string
}

func (f *fakeSource) Transcripts() ([]core.TranscriptRef, error) { return f.refs, nil }

func (f *fakeSource) Transcript(_, line string) (bool, error) {
	f.lines = append(f.lines, line)
	return true, nil
}
