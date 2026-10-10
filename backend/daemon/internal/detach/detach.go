//go:build unix

// Package detach starts a server in the background, in a session of its own, so it outlives the
// process that asked for it: a Claude Code hook is killed with its whole process group.
package detach

import (
	"errors"
	"fmt"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"syscall"
	"time"
)

// Running tells whether something accepts connections at addr.
func Running(addr string) bool {
	conn, err := net.DialTimeout("tcp", addr, dialTimeout)
	if err != nil {
		return false
	}
	_ = conn.Close() // only the connect mattered
	return true
}

// Start launches p detached from this process and waits until it listens on p.Addr.
func Start(p Process) error {
	if err := os.MkdirAll(filepath.Dir(p.LogPath), logDirMode); err != nil {
		return fmt.Errorf("create log directory: %w", err)
	}
	log, err := os.OpenFile(p.LogPath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, logMode)
	if err != nil {
		return fmt.Errorf("open log: %w", err)
	}
	defer log.Close() // the child keeps its own descriptor

	cmd := exec.Command(p.Exe, p.Args...)
	cmd.Env = p.Env
	cmd.Stdout, cmd.Stderr = log, log
	cmd.SysProcAttr = &syscall.SysProcAttr{Setsid: true}
	if err := cmd.Start(); err != nil {
		return fmt.Errorf("start %s: %w", p.Exe, err)
	}
	exited := make(chan error, 1)
	go func() { exited <- cmd.Wait() }()

	wait := p.Wait
	if wait <= 0 {
		wait = DefaultWait
	}
	deadline := time.After(wait)
	tick := time.NewTicker(pollEvery)
	defer tick.Stop()
	for {
		if Running(p.Addr) {
			return nil
		}
		select {
		case err := <-exited:
			// Another one may have won the race for the port; that is as good as starting.
			if Running(p.Addr) {
				return nil
			}
			return fmt.Errorf("%s exited before listening (see %s): %w", p.Exe, p.LogPath, errOrExit(err))
		case <-deadline:
			return fmt.Errorf("%s did not listen on %s within %s (see %s)", p.Exe, p.Addr, wait, p.LogPath)
		case <-tick.C:
		}
	}
}

func errOrExit(err error) error {
	if err == nil {
		return errors.New("exit status 0")
	}
	return err
}

// WaitStopped waits until nothing accepts connections at addr any more.
func WaitStopped(addr string, wait time.Duration) error {
	deadline := time.Now().Add(wait)
	for Running(addr) {
		if time.Now().After(deadline) {
			return fmt.Errorf("%s still answers after %s", addr, wait)
		}
		time.Sleep(pollEvery)
	}
	return nil
}
