// Package store keeps the sessions and the settings in files across restarts.
package store

import (
	"fmt"
	"log/slog"
)

// Open locates the files, gives p what the last run left in them and returns what is needed
// to persist later changes. A file that can't be located or read costs persistence only.
func Open(p Persistable) Files {
	var files Files
	sessionsPath, err := xdgFile(envStateHome, stateHomeFallback, sessionsFileName)
	if err != nil {
		slog.Warn("sessions are not kept", "err", err)
	} else {
		files.Saver = NewSaver(p, sessionsPath, SaveEvery)
		if err := loadSessions(p, sessionsPath); err != nil {
			slog.Warn("sessions not restored", "err", err)
		}
	}
	files.SettingsPath, err = xdgFile(envConfigHome, configHomeFallback, settingsFileName)
	if err != nil {
		slog.Warn("settings are not kept", "err", err)
		return files
	}
	if err := loadSettings(p, files.SettingsPath); err != nil {
		slog.Warn("settings not restored", "err", err)
	}
	return files
}

// loadSessions gives r the sessions of the last run.
func loadSessions(r interface{ Restore(string) error }, path string) error {
	data, ok, err := readJSON(path)
	if err != nil || !ok {
		return err
	}
	if err := r.Restore(string(data)); err != nil {
		return fmt.Errorf("restore sessions: %w", err)
	}
	return nil
}

// loadSettings gives l the settings file; a missing or bad file means the defaults.
func loadSettings(l interface{ LoadSettings(string) error }, path string) error {
	data, ok, err := readJSON(path)
	if err != nil {
		return err
	}
	if !ok {
		data = []byte("null")
	}
	if err := l.LoadSettings(string(data)); err != nil {
		return fmt.Errorf("load settings: %w", err)
	}
	return nil
}
