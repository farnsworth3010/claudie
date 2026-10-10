package watch_test

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"claudie/daemon/internal/core"
	"claudie/daemon/internal/watch"
)

func TestTailerReadsLinesAsTheyAreCompleted(t *testing.T) {
	c := newCore(t)
	tl := watch.NewTailer(c)
	path := filepath.Join(t.TempDir(), "s1.jsonl")
	appendTo(t, path, padLine+"\n")
	sessionWithTranscript(t, c, path)

	// Everything already in the file is read once, and says nothing here.
	if tl.Step() {
		t.Fatal("the history of the file changed something")
	}

	// A line that is still being written waits for its end.
	half := len(interruptedLine) / 2
	appendTo(t, path, interruptedLine[:half])
	if tl.Step() || activityOf(t, c) != "thinking/none" {
		t.Fatalf("an incomplete line counted: %s", activityOf(t, c))
	}
	appendTo(t, path, interruptedLine[half:]+"\n")
	if !tl.Step() {
		t.Fatal("the completed line changed nothing")
	}
	if got := activityOf(t, c); got != "idle/interrupted" {
		t.Fatalf("state %s, want idle/interrupted", got)
	}
	if tl.Step() {
		t.Error("a step without news reported a change")
	}
}

func TestTailerStartsAgainWhenTheFileShrinks(t *testing.T) {
	c := newCore(t)
	tl := watch.NewTailer(c)
	path := filepath.Join(t.TempDir(), "s1.jsonl")
	appendTo(t, path, strings.Repeat(padLine+"\n", 5))
	sessionWithTranscript(t, c, path)
	tl.Step()

	if err := os.WriteFile(path, []byte(interruptedLine+"\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	if !tl.Step() {
		t.Fatal("the rewritten file changed nothing")
	}
	if got := activityOf(t, c); got != "idle/interrupted" {
		t.Errorf("state %s, want idle/interrupted", got)
	}
}

func TestTailerFollowsASwappedFile(t *testing.T) {
	c := newCore(t)
	tl := watch.NewTailer(c)
	dir := t.TempDir()
	old, fresh := filepath.Join(dir, "old.jsonl"), filepath.Join(dir, "fresh.jsonl")
	appendTo(t, old, padLine+"\n")
	appendTo(t, fresh, interruptedLine+"\n")
	sessionWithTranscript(t, c, old)
	tl.Step()

	// /clear: the same session, a new file.
	hook(t, c, `{"hook_event_name":"UserPromptSubmit","session_id":"s1","transcript_path":"`+fresh+`"}`)
	if !tl.Step() {
		t.Fatal("the new file changed nothing")
	}
	if got := activityOf(t, c); got != "idle/interrupted" {
		t.Errorf("state %s, want idle/interrupted", got)
	}
}

func TestTailerSkipsMissingFiles(t *testing.T) {
	c := newCore(t)
	tl := watch.NewTailer(c)
	sessionWithTranscript(t, c, filepath.Join(t.TempDir(), "never-written.jsonl"))
	if tl.Step() {
		t.Error("a missing file changed something")
	}
}

func TestTailerReadsOnlyTheEndOfABigFileFirst(t *testing.T) {
	const window = 1 << 20 // what a file seen for the first time is read from the end
	src := &fakeSource{}
	tl := watch.NewTailer(src)
	path := filepath.Join(t.TempDir(), "s1.jsonl")
	// The line older than the window is never read.
	appendTo(t, path, interruptedLine+"\n"+strings.Repeat(padLine+"\n", window/len(padLine)+10))
	src.refs = []core.TranscriptRef{{ID: "s1", Path: path}}

	tl.Step()
	perWindow := window / (len(padLine) + 1)
	// The line the window cuts in two is dropped; every other line in it arrives whole.
	if n := len(src.lines); n < perWindow-1 || n > perWindow {
		t.Errorf("%d lines read, want about %d", n, perWindow)
	}
	for _, line := range src.lines {
		if line != padLine {
			t.Fatalf("line %q read, want only whole lines from the window", line)
		}
	}
	// Nothing is read twice.
	read := len(src.lines)
	tl.Step()
	if len(src.lines) != read {
		t.Errorf("a step without news fed %d more lines", len(src.lines)-read)
	}
	appendTo(t, path, interruptedLine+"\n")
	tl.Step()
	if len(src.lines) != read+1 || src.lines[read] != interruptedLine {
		t.Errorf("after one more line, fed %d lines, want %d ending with it", len(src.lines), read+1)
	}
}

func TestTailerForgetsSessionsThatLeftTheList(t *testing.T) {
	src := &fakeSource{}
	tl := watch.NewTailer(src)
	path := filepath.Join(t.TempDir(), "s1.jsonl")
	appendTo(t, path, padLine+"\n")
	ref := core.TranscriptRef{ID: "s1", Path: path}

	src.refs = []core.TranscriptRef{ref}
	tl.Step()
	tl.Step()
	if len(src.lines) != 1 {
		t.Fatalf("%d lines fed, want the one line once", len(src.lines))
	}

	// Gone from the list and back: its file is read from the start again.
	src.refs = nil
	tl.Step()
	src.refs = []core.TranscriptRef{ref}
	tl.Step()
	if len(src.lines) != 2 {
		t.Errorf("%d lines fed, want the file read afresh, 2", len(src.lines))
	}
}
