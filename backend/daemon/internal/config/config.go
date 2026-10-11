// Package config reads the daemon's settings from the environment.
package config

import (
	"fmt"
	"net"
	"strconv"
)

// Load reads the configuration through getenv, so tests need no real environment.
func Load(getenv func(string) string) (Config, error) {
	port, err := portFrom(getenv(envPort))
	if err != nil {
		return Config{}, err
	}
	return Config{Port: port, EventLogPath: getenv(envEventLog)}, nil
}

// Addr is where the daemon listens.
func (c Config) Addr() string {
	return net.JoinHostPort(loopback, strconv.Itoa(c.Port))
}

// Hosts are the Host header values the daemon answers to.
func (c Config) Hosts() []string {
	p := strconv.Itoa(c.Port)
	return []string{net.JoinHostPort(loopback, p), net.JoinHostPort("localhost", p)}
}

// portFrom reads the port from CLAUDIE_PORT's value; empty means the default.
func portFrom(s string) (int, error) {
	if s == "" {
		return DefaultPort, nil
	}
	port, err := strconv.Atoi(s)
	if err != nil || port < 1 || port > 65535 {
		return 0, fmt.Errorf("bad %s %q", envPort, s)
	}
	return port, nil
}
