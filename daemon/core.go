package main

import (
	_ "embed"
	"fmt"
	"sync"
	"time"

	"github.com/dop251/goja"
)

// core.js is core/src/daemon-entry.ts bundled by `pnpm build`: all the session logic lives there.
//
//go:embed core.js
var coreJS string

// core runs the TypeScript logic in goja, a JavaScript engine written in Go. A goja runtime
// must not be used from two goroutines at once, and HTTP handlers run concurrently, so every
// call takes the lock.
type core struct {
	mu  sync.Mutex
	vm  *goja.Runtime
	api map[string]goja.Callable
}

func newCore() (*core, error) {
	vm := goja.New()
	if _, err := vm.RunString(coreJS); err != nil {
		return nil, fmt.Errorf("core.js: %w", err)
	}
	obj := vm.Get("claudie")
	if obj == nil {
		return nil, fmt.Errorf("core.js: no claudie object")
	}
	c := &core{vm: vm, api: map[string]goja.Callable{}}
	for _, name := range []string{"hook", "snapshot"} {
		fn, ok := goja.AssertFunction(obj.ToObject(vm).Get(name))
		if !ok {
			return nil, fmt.Errorf("core.js: claudie.%s is not a function", name)
		}
		c.api[name] = fn
	}
	return c, nil
}

func (c *core) call(name string, args ...any) (goja.Value, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	values := make([]goja.Value, len(args))
	for i, arg := range args {
		values[i] = c.vm.ToValue(arg)
	}
	return c.api[name](goja.Undefined(), values...)
}

// hook applies one received event; it reports whether any session changed.
func (c *core) hook(envelope []byte) (bool, error) {
	v, err := c.call("hook", string(envelope))
	if err != nil {
		return false, err
	}
	return v.ToBoolean(), nil
}

// snapshot is every session as JSON, stamped with the daemon's clock.
func (c *core) snapshot(now time.Time) (string, error) {
	v, err := c.call("snapshot", now.UnixMilli())
	if err != nil {
		return "", err
	}
	return v.String(), nil
}
