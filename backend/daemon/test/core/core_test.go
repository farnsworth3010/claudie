package core_test

import (
	"strings"
	"testing"
	"time"

	"claudie/daemon/internal/core"
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

func TestHookReportsChangesAndSnapshotShowsThem(t *testing.T) {
	c := newCore(t)
	changed, err := c.Hook([]byte(`{"received":1700000000000,"pid":4242,"event":{"hook_event_name":"UserPromptSubmit","session_id":"s1"}}`))
	if err != nil || !changed {
		t.Fatalf("Hook: %v, %v; want a change", changed, err)
	}
	snap, err := c.Snapshot(time.UnixMilli(1_700_000_000_000))
	if err != nil || !strings.Contains(snap, `"id":"s1"`) || !strings.Contains(snap, `"thinking"`) {
		t.Errorf("snapshot %s, %v", snap, err)
	}
}

func TestErrorsNameTheFunctionThatFailed(t *testing.T) {
	_, err := newCore(t).Hook([]byte(`not json`))
	if err == nil || !strings.Contains(err.Error(), "claudie.hook") {
		t.Errorf("error %v, want one that names claudie.hook", err)
	}
}

func TestTranscriptsListsTheSessionsWithAFile(t *testing.T) {
	c := newCore(t)
	if _, err := c.Hook([]byte(`{"received":1,"event":{"hook_event_name":"SessionStart","session_id":"s1","transcript_path":"/t/s1.jsonl"}}`)); err != nil {
		t.Fatal(err)
	}
	refs, err := c.Transcripts()
	if err != nil || len(refs) != 1 || refs[0] != (core.TranscriptRef{ID: "s1", Path: "/t/s1.jsonl"}) {
		t.Errorf("refs %+v, %v", refs, err)
	}
}

func TestUpdateSettingsRefusesBadPatches(t *testing.T) {
	c := newCore(t)
	if _, ok, err := c.UpdateSettings(`{"colour":"red"}`); err != nil || ok {
		t.Errorf("unknown field: ok %v, err %v; want a refusal", ok, err)
	}
	if got, ok, err := c.UpdateSettings(`{"size":6}`); err != nil || !ok || !strings.Contains(got, `"size":6`) {
		t.Errorf("good patch: %s, %v, %v", got, ok, err)
	}
}
