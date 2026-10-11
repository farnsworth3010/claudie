package detach

import (
	"os"
	"time"
)

const (
	// DefaultWait is how long Start waits for the process to listen.
	DefaultWait = 3 * time.Second
	pollEvery   = 50 * time.Millisecond
	dialTimeout = 200 * time.Millisecond
	logMode     = os.FileMode(0o600)
	logDirMode  = os.FileMode(0o700)
)
