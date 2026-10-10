// Command claudie-daemon keeps the state of Claude Code sessions and streams it to the overlay.
package main

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"strconv"
	"time"
)

const defaultPort = 47321

func main() {
	port, err := portFrom(os.Getenv("CLAUDIE_PORT"))
	if err != nil {
		fail(err)
	}

	log := &eventLog{out: []io.Writer{os.Stdout}, now: time.Now}
	// CLAUDIE_EVENT_LOG: also append every event to this file, to replay real sessions in tests.
	if path := os.Getenv("CLAUDIE_EVENT_LOG"); path != "" {
		f, err := os.OpenFile(path, os.O_WRONLY|os.O_APPEND|os.O_CREATE, 0o600)
		if err != nil {
			fail(err)
		}
		log.out = append(log.out, f)
	}

	mux := http.NewServeMux()
	mux.Handle("/hook", log)
	addr := fmt.Sprintf("127.0.0.1:%d", port)
	fmt.Fprintln(os.Stderr, "claudie-daemon: listening on", addr)
	fail(http.ListenAndServe(addr, mux))
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
