package proc

import (
	"bytes"
	"fmt"
	"os"
)

// Alive tells whether pid is a running Claude Code. Saved sessions outlive reboots, so a live pid
// may belong to another program; the process's comm is a version number, so look in its command line.
func Alive(pid int) bool {
	if !running(pid) {
		return false
	}
	cmdline, err := os.ReadFile(fmt.Sprintf("/proc/%d/cmdline", pid))
	if err != nil {
		return true
	}
	return bytes.Contains(cmdline, []byte("claude"))
}
