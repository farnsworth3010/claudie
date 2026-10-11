package client_test

import (
	"context"
	"net"
	"testing"
	"time"

	"claudie/daemon/internal/client"
	"claudie/daemon/internal/core"
	"claudie/daemon/internal/server"
)

// serve runs a server on a free port; quit is closed when it is asked to quit.
func serve(t *testing.T, quit func()) string {
	t.Helper()
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	c, err := core.New()
	if err != nil {
		t.Fatal(err)
	}
	addr := ln.Addr().String()
	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)
	go func() {
		_ = server.New(server.Options{Engine: c, Hosts: []string{addr}, Version: "1.2.3", Quit: quit}).Serve(ctx, ln)
	}()
	return addr
}

func TestVersionAndQuit(t *testing.T) {
	asked := make(chan struct{})
	addr := serve(t, func() { close(asked) })
	if v, err := client.Version(addr); err != nil || v != "1.2.3" {
		t.Fatalf("version %q, %v", v, err)
	}
	if err := client.Quit(addr); err != nil {
		t.Fatal(err)
	}
	select {
	case <-asked:
	case <-time.After(5 * time.Second):
		t.Fatal("the server was not asked to quit")
	}
}

func TestQuitIsRefusedWithoutAWayToStop(t *testing.T) {
	addr := serve(t, nil)
	if err := client.Quit(addr); err == nil {
		t.Fatal("quit accepted by a server that can't stop")
	}
}
