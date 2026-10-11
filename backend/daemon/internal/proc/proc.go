//go:build unix

// Package proc checks whether the processes of Claude Code sessions still run.
package proc

import (
	"errors"
	"syscall"
)

// running tells whether a process with this pid exists; EPERM means it does, but isn't ours.
func running(pid int) bool {
	if pid <= 0 { // kill(0) would signal our own process group
		return false
	}
	err := syscall.Kill(pid, 0)
	return err == nil || errors.Is(err, syscall.EPERM)
}
