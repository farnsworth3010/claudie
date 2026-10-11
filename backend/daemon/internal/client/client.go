// Package client talks to a daemon that is already running: what version it is, and asking it to quit.
package client

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
)

// Version asks the daemon at addr (host:port) for its version.
func Version(addr string) (string, error) {
	resp, err := httpClient.Get("http://" + addr + versionPath)
	if err != nil {
		return "", fmt.Errorf("ask version: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("ask version: HTTP %d", resp.StatusCode)
	}
	var body struct {
		Version string `json:"version"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		return "", fmt.Errorf("read version: %w", err)
	}
	return body.Version, nil
}

// Quit asks the daemon at addr to stop.
func Quit(addr string) error {
	resp, err := httpClient.Post("http://"+addr+quitPath, mimeJSON, strings.NewReader("{}"))
	if err != nil {
		return fmt.Errorf("ask to quit: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusAccepted {
		return fmt.Errorf("ask to quit: HTTP %d", resp.StatusCode)
	}
	return nil
}
