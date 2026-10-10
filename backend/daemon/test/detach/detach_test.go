package detach_test

import (
	"net"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"claudie/daemon/internal/detach"
)

// envListen makes the test binary itself the child: it listens there until killed.
const envListen = "DETACH_TEST_LISTEN"

func TestMain(m *testing.M) {
	if addr := os.Getenv(envListen); addr != "" {
		ln, err := net.Listen("tcp", addr)
		if err != nil {
			os.Exit(3)
		}
		defer ln.Close()
		time.Sleep(5 * time.Second)
		return
	}
	os.Exit(m.Run())
}

func freeAddr(t *testing.T) string {
	t.Helper()
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	addr := ln.Addr().String()
	ln.Close()
	return addr
}

func TestStartWaitsUntilTheProcessListens(t *testing.T) {
	addr := freeAddr(t)
	logPath := filepath.Join(t.TempDir(), "logs", "daemon.log")
	err := detach.Start(detach.Process{
		Exe:     os.Args[0],
		Env:     append(os.Environ(), envListen+"="+addr),
		LogPath: logPath,
		Addr:    addr,
	})
	if err != nil {
		t.Fatal(err)
	}
	if !detach.Running(addr) {
		t.Fatal("not listening after Start returned")
	}
	if _, err := os.Stat(logPath); err != nil {
		t.Errorf("log not created: %v", err)
	}
}

func TestStartReportsAProcessThatNeverListens(t *testing.T) {
	addr := freeAddr(t)
	logPath := filepath.Join(t.TempDir(), "daemon.log")
	err := detach.Start(detach.Process{Exe: "/bin/sh", Args: []string{"-c", "echo broken; exit 1"}, LogPath: logPath, Addr: addr})
	if err == nil || !strings.Contains(err.Error(), "exited before listening") {
		t.Fatalf("got %v", err)
	}
	if b, _ := os.ReadFile(logPath); !strings.Contains(string(b), "broken") {
		t.Errorf("log holds %q, want the child's output", b)
	}
	err = detach.Start(detach.Process{Exe: "/bin/sleep", Args: []string{"5"}, LogPath: logPath, Addr: addr, Wait: 200 * time.Millisecond})
	if err == nil || !strings.Contains(err.Error(), "did not listen") {
		t.Fatalf("got %v", err)
	}
}

func TestRunning(t *testing.T) {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	addr := ln.Addr().String()
	if !detach.Running(addr) {
		t.Error("an open listener is not running")
	}
	ln.Close()
	if detach.Running(addr) {
		t.Error("a closed port is running")
	}
}
