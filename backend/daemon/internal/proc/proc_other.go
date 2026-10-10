//go:build !linux

package proc

// Alive tells whether pid is a running process; there is no /proc here to check it is Claude Code.
func Alive(pid int) bool { return running(pid) }
