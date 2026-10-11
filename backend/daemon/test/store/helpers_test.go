package store_test

import (
	"os"
	"path/filepath"
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

// coreWithSession returns a core holding one thinking session, s1, with pid 4242.
func coreWithSession(t *testing.T) *core.Core {
	t.Helper()
	c := newCore(t)
	for _, line := range []string{
		`{"received":1700000000000,"pid":4242,"event":{"hook_event_name":"SessionStart","session_id":"s1","cwd":"/p/demo"}}`,
		`{"received":1700000000000,"event":{"hook_event_name":"UserPromptSubmit","session_id":"s1"}}`,
	} {
		if _, err := c.Hook([]byte(line)); err != nil {
			t.Fatal(err)
		}
	}
	return c
}

// snapshot is the core's state as JSON.
func snapshot(t *testing.T, c *core.Core) string {
	t.Helper()
	snap, err := c.Snapshot(time.UnixMilli(0))
	if err != nil {
		t.Fatal(err)
	}
	return snap
}

// writeFile writes content to path, creating its directory.
func writeFile(t *testing.T, path, content string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatal(err)
	}
}

// xdgDirs points the XDG variables at fresh directories and returns the state and config
// files of the daemon in them.
func xdgDirs(t *testing.T) (sessions, settings string) {
	t.Helper()
	state, config := t.TempDir(), t.TempDir()
	t.Setenv("XDG_STATE_HOME", state)
	t.Setenv("XDG_CONFIG_HOME", config)
	return filepath.Join(state, "claudie", "sessions.json"), filepath.Join(config, "claudie", "settings.json")
}
