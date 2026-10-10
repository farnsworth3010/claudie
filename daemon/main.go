// Command claudie-daemon keeps the state of Claude Code sessions and streams it to the overlay.
package main

import (
	"fmt"
	"net/http"
	"os"
	"strconv"
)

const defaultPort = 47321

func main() {
	port, err := portFrom(os.Getenv("CLAUDIE_PORT"))
	if err != nil {
		fail(err)
	}
	c, err := newCore()
	if err != nil {
		fail(err)
	}

	var log *eventLog
	// CLAUDIE_EVENT_LOG: append every event to this file, to replay real sessions in tests.
	// It grows without bound; turn it on only while recording.
	if path := os.Getenv("CLAUDIE_EVENT_LOG"); path != "" {
		f, err := os.OpenFile(path, os.O_WRONLY|os.O_APPEND|os.O_CREATE, 0o600)
		if err != nil {
			fail(err)
		}
		log = &eventLog{out: f}
	}

	addr := fmt.Sprintf("127.0.0.1:%d", port)
	fmt.Fprintln(os.Stderr, "claudie-daemon: listening on", addr)
	fail(http.ListenAndServe(addr, newServer(c, log, port).handler()))
}

func fail(err error) {
	fmt.Fprintln(os.Stderr, "claudie-daemon:", err)
	os.Exit(2)
}

// portFrom reads the port from CLAUDIE_PORT's value; empty means the default.
func portFrom(s string) (int, error) {
	if s == "" {
		return defaultPort, nil
	}
	port, err := strconv.Atoi(s)
	if err != nil || port < 1 || port > 65535 {
		return 0, fmt.Errorf("bad CLAUDIE_PORT %q", s)
	}
	return port, nil
}
