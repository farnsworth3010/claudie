// Command claudie-daemon keeps the state of Claude Code sessions and streams it to the overlay.
package main

import (
	"context"
	"fmt"
	"log/slog"
	"net"
	"os"
	"os/signal"
	"strings"
	"syscall"

	"claudie/daemon/internal/client"
	"claudie/daemon/internal/config"
	"claudie/daemon/internal/core"
	"claudie/daemon/internal/detach"
	"claudie/daemon/internal/eventlog"
	"claudie/daemon/internal/server"
	"claudie/daemon/internal/store"
	"claudie/daemon/internal/version"
)

// Usage: claudie-daemon        serve in the foreground until SIGINT or SIGTERM
//
//	claudie-daemon start  serve in the background unless a daemon of this version already answers;
//	                      one of another version is asked to quit first. Returns once it serves.
func main() {
	slog.SetDefault(slog.New(slog.NewTextHandler(os.Stderr, nil)))
	var err error
	switch command := strings.Join(os.Args[1:], " "); command {
	case "":
		err = run()
	case "start":
		err = start()
	default:
		err = fmt.Errorf("unknown command %q; use no arguments or \"start\"", command)
	}
	if err != nil {
		slog.Error("claudie-daemon failed", "err", err)
		os.Exit(2)
	}
}

// start runs this same binary in the background, detached from the caller: the plugin's hook calls
// it when nothing answers on the port.
func start() error {
	cfg, err := config.Load(os.Getenv)
	if err != nil {
		return err
	}
	if detach.Running(cfg.Addr()) {
		if !replaces(cfg.Addr()) {
			return nil
		}
		if err := client.Quit(cfg.Addr()); err != nil {
			return err
		}
		if err := detach.WaitStopped(cfg.Addr(), detach.DefaultWait); err != nil {
			return err
		}
	}
	exe, err := os.Executable()
	if err != nil {
		return fmt.Errorf("find own binary: %w", err)
	}
	logPath, err := store.LogPath()
	if err != nil {
		return err
	}
	return detach.Start(detach.Process{Exe: exe, LogPath: logPath, Addr: cfg.Addr()})
}

// run wires the daemon up and serves until SIGINT or SIGTERM.
func run() error {
	cfg, err := config.Load(os.Getenv)
	if err != nil {
		return err
	}
	c, err := core.New()
	if err != nil {
		return err
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	opts := server.Options{Engine: c, Hosts: cfg.Hosts(), Version: version.Version, Quit: stop}
	if cfg.EventLogPath != "" {
		if opts.EventLog, err = eventlog.Open(cfg.EventLogPath); err != nil {
			return err
		}
		defer opts.EventLog.Close()
	}
	files := store.Open(c)
	opts.Saver, opts.SettingsPath = files.Saver, files.SettingsPath

	ln, err := net.Listen("tcp", cfg.Addr())
	if err != nil {
		return fmt.Errorf("listen: %w", err)
	}
	slog.Info("listening", "addr", ln.Addr().String())

	return server.New(opts).Serve(ctx, ln)
}

// replaces tells whether this binary should take over from the daemon running at addr: a release
// replaces another release of a different version, never a build from source, nor one it can't ask.
func replaces(addr string) bool {
	if version.Version == version.Dev {
		return false
	}
	running, err := client.Version(addr)
	if err != nil {
		slog.Warn("running daemon's version unknown; leaving it", "err", err)
		return false
	}
	return running != version.Version && running != version.Dev
}
