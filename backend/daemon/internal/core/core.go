// Package core runs the session logic, written in TypeScript and bundled into core.js, in goja.
package core

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"time"

	"github.com/dop251/goja"
)

// core.js is backend/core/src/entries/daemon.ts bundled by `pnpm build`: all the session logic lives there.
//
//go:embed core.js
var coreJS string

// New loads core.js and looks up every function of its API.
func New() (*Core, error) {
	vm := goja.New()
	if _, err := vm.RunString(coreJS); err != nil {
		return nil, fmt.Errorf("run core.js: %w", err)
	}
	obj := vm.Get(globalName)
	if obj == nil {
		return nil, fmt.Errorf("core.js has no %s object", globalName)
	}
	api := make(map[string]goja.Callable, len(apiNames))
	for _, name := range apiNames {
		fn, ok := goja.AssertFunction(obj.ToObject(vm).Get(name))
		if !ok {
			return nil, fmt.Errorf("core.js: %s.%s is not a function", globalName, name)
		}
		api[name] = fn
	}
	return &Core{vm: vm, api: api}, nil
}

// Hook applies one received event; it reports whether any session changed.
func (c *Core) Hook(envelope []byte) (bool, error) {
	return invoke(c, "hook", asBool, string(envelope))
}

// Snapshot is every session as JSON, stamped with the daemon's clock.
func (c *Core) Snapshot(now time.Time) (string, error) {
	return invoke(c, "snapshot", asString, now.UnixMilli())
}

// Transcript feeds one line of session id's transcript file; it reports whether anything changed.
func (c *Core) Transcript(id, line string) (bool, error) {
	return invoke(c, "transcript", asBool, id, line)
}

// Tick ages sessions and lets go of those whose process is gone; it reports whether anything
// changed. alive runs while the core is locked, so it must not call the core.
func (c *Core) Tick(now time.Time, alive func(pid int) bool) (bool, error) {
	return invoke(c, "tick", asBool, now.UnixMilli(), alive)
}

// Transcripts lists the sessions whose transcript files should be tailed.
func (c *Core) Transcripts() ([]TranscriptRef, error) {
	raw, err := invoke(c, "transcripts", asString)
	if err != nil {
		return nil, err
	}
	var refs []TranscriptRef
	if err := json.Unmarshal([]byte(raw), &refs); err != nil {
		return nil, fmt.Errorf("decode transcripts: %w", err)
	}
	return refs, nil
}

// Save is the sessions to keep across restarts, as JSON.
func (c *Core) Save() (string, error) {
	return invoke(c, "save", asString)
}

// Restore gives back what Save returned.
func (c *Core) Restore(saved string) error {
	_, err := invoke(c, "restore", asNothing, saved)
	return err
}

// Settings is the current settings as JSON.
func (c *Core) Settings() (string, error) {
	return invoke(c, "settings", asString)
}

// LoadSettings hands over the settings file's JSON; "null" when there is none.
func (c *Core) LoadSettings(raw string) error {
	_, err := invoke(c, "loadSettings", asNothing, raw)
	return err
}

// UpdateSettings applies a client's patch and returns the settings after it; ok is false when
// the patch is refused.
func (c *Core) UpdateSettings(patch string) (settings string, ok bool, err error) {
	settings, err = invoke(c, "updateSettings", asString, patch)
	if err != nil {
		return "", false, err
	}
	return settings, settings != "", nil
}
