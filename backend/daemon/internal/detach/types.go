package detach

import "time"

// Process is a program to start in the background and the address it serves on once it is up.
type Process struct {
	Exe     string
	Args    []string
	Env     []string // nil: the current environment
	LogPath string   // its stdout and stderr; truncated on every start so it never grows unbounded
	Addr    string   // host:port it listens on
	Wait    time.Duration
}
