package proc_test

import (
	"fmt"
	"os"
	"os/exec"
	"testing"
	"time"

	"claudie/daemon/internal/proc"
)

func TestAliveRecognisesClaude(t *testing.T) {
	// A process whose command line says claude, like the real one.
	cmd := exec.Command("sleep", "30")
	cmd.Args[0] = "claude"
	if err := cmd.Start(); err != nil {
		t.Skip(err)
	}
	pid := cmd.Process.Pid
	// The command line reads empty for a moment after the start.
	for deadline := time.Now().Add(2 * time.Second); time.Now().Before(deadline); time.Sleep(time.Millisecond) {
		if b, _ := os.ReadFile(fmt.Sprintf("/proc/%d/cmdline", pid)); len(b) > 0 {
			break
		}
	}
	if !proc.Alive(pid) {
		t.Error("a running claude is not alive")
	}
	if proc.Alive(os.Getpid()) {
		t.Error("a live process that is not claude is alive")
	}
	_ = cmd.Process.Kill() // the process may be gone already; the next check says so
	_ = cmd.Wait()         // reaps it; the error is the kill's exit status
	if proc.Alive(pid) {
		t.Error("a dead process is alive")
	}
	if proc.Alive(0) || proc.Alive(-1) {
		t.Error("pid 0 or -1 is alive")
	}
}
