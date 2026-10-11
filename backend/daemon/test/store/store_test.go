package store_test

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"claudie/daemon/internal/store"
)

func TestSessionsSurviveARestart(t *testing.T) {
	sessions, _ := xdgDirs(t)
	if err := store.NewSaver(coreWithSession(t), sessions, store.SaveEvery).Flush(); err != nil {
		t.Fatal(err)
	}

	if info, err := os.Stat(sessions); err != nil || info.Mode().Perm() != 0o600 {
		t.Fatalf("sessions file: %v, %v; want mode 0600", info, err)
	}
	if info, err := os.Stat(filepath.Dir(sessions)); err != nil || info.Mode().Perm() != 0o700 {
		t.Fatalf("state directory: %v, %v; want mode 0700", info, err)
	}
	if left, _ := filepath.Glob(sessions + ".*"); len(left) != 0 {
		t.Errorf("temporary files left: %v", left)
	}

	again := newCore(t)
	if files := store.Open(again); files.Saver == nil {
		t.Fatal("Open found no place for the sessions")
	}
	snap := snapshot(t, again)
	if !strings.Contains(snap, `"id":"s1"`) || !strings.Contains(snap, `"pid":4242`) {
		t.Errorf("restored snapshot %s lacks the session", snap)
	}
}

func TestOpenIgnoresMissingAndBadSessionFiles(t *testing.T) {
	for name, content := range map[string]string{"missing": "", "bad": `[{"id":`} {
		t.Run(name, func(t *testing.T) {
			sessions, _ := xdgDirs(t)
			if content != "" {
				writeFile(t, sessions, content)
			}
			c := newCore(t)
			if files := store.Open(c); files.Saver == nil {
				t.Error("the saver is missing")
			}
			if snap := snapshot(t, c); strings.Contains(snap, `"id"`) {
				t.Errorf("snapshot %s, want no sessions", snap)
			}
		})
	}
}

func TestOpenLoadsTheSettingsFile(t *testing.T) {
	tests := []struct{ name, content, want string }{
		{"good", `{"size":8}`, `"size":8`},
		{"junk", `{"size":`, `"size":4`},
		{"missing", "", `"size":4`},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, settings := xdgDirs(t)
			if tt.content != "" {
				writeFile(t, settings, tt.content)
			}
			c := newCore(t)
			if files := store.Open(c); files.SettingsPath != settings {
				t.Errorf("settings path %q, want %q", files.SettingsPath, settings)
			}
			if got, _ := c.Settings(); !strings.Contains(got, tt.want) {
				t.Errorf("settings %s, want %s", got, tt.want)
			}
		})
	}
}

func TestFilesLiveUnderTheXDGDirectoryOrTheHomeFallback(t *testing.T) {
	t.Setenv("HOME", "/home/me")
	tests := []struct{ name, env, want string }{
		{"absolute value", "/x/config", "/x/config/claudie/settings.json"},
		{"relative value ignored", "config", "/home/me/.config/claudie/settings.json"},
		{"unset", "", "/home/me/.config/claudie/settings.json"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Setenv("XDG_STATE_HOME", t.TempDir())
			t.Setenv("XDG_CONFIG_HOME", tt.env)
			if got := store.Open(newCore(t)).SettingsPath; got != tt.want {
				t.Errorf("%q, want %q", got, tt.want)
			}
		})
	}
}

func TestOpenRestoresSessionsAndSettingsTogether(t *testing.T) {
	sessions, settings := xdgDirs(t)
	if err := store.NewSaver(coreWithSession(t), sessions, store.SaveEvery).Flush(); err != nil {
		t.Fatal(err)
	}
	if err := store.WriteFileAtomic(settings, []byte(`{"size":9}`)); err != nil {
		t.Fatal(err)
	}

	c := newCore(t)
	store.Open(c)
	if snap := snapshot(t, c); !strings.Contains(snap, `"id":"s1"`) || !strings.Contains(snap, `"size":9`) {
		t.Errorf("snapshot %s lacks the restored session or settings", snap)
	}
}
