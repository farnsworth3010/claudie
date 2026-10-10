package core

import (
	"sync"

	"github.com/dop251/goja"
)

// Core runs the TypeScript logic in goja, a JavaScript engine written in Go. A goja runtime
// must not be used from two goroutines at once, and HTTP handlers run concurrently, so every
// call takes the lock.
type Core struct {
	mu  sync.Mutex
	vm  *goja.Runtime
	api map[string]goja.Callable
}

// TranscriptRef is a session whose transcript file should be tailed.
type TranscriptRef struct {
	ID   string `json:"id"`
	Path string `json:"path"`
}
