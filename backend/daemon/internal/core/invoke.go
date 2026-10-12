package core

import (
	"fmt"

	"github.com/dop251/goja"
)

// Result converters for invoke.
var (
	asBool    = goja.Value.ToBoolean
	asString  = goja.Value.String
	asInt     = func(v goja.Value) int { return int(v.ToInteger()) }
	asNothing = func(goja.Value) struct{} { return struct{}{} }
)

// invoke calls claudie.name and converts the result, all under the lock: a goja value belongs
// to the runtime and must not be touched outside it.
func invoke[T any](c *Core, name string, conv func(goja.Value) T, args ...any) (T, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	values := make([]goja.Value, len(args))
	for i, arg := range args {
		values[i] = c.vm.ToValue(arg)
	}
	v, err := c.api[name](goja.Undefined(), values...)
	if err != nil {
		var zero T
		return zero, fmt.Errorf("%s.%s: %w", globalName, name, err)
	}
	return conv(v), nil
}
