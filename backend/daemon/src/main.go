// Command claudie-daemon keeps the state of Claude Code sessions and streams it to the overlay.
package main

import (
	"context"
	"fmt"
	"log/slog"
	"net"
	"os"
	"os/signal"
	"syscall"

	"claudie/daemon/internal/config"
	"claudie/daemon/internal/core"
	"claudie/daemon/internal/eventlog"
	"claudie/daemon/internal/server"
	"claudie/daemon/internal/store"
)

func main() {
	slog.SetDefault(slog.New(slog.NewTextHandler(os.Stderr, nil)))
	if err := run(); err != nil {
		slog.Error("claudie-daemon failed", "err", err)
		os.Exit(2)
	}
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

	opts := server.Options{Engine: c, Hosts: cfg.Hosts()}
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

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	return server.New(opts).Serve(ctx, ln)
}
