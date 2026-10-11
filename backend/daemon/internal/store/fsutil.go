package store

import (
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
)

// xdgFile is claudie/name under the XDG directory in env, or under fallback in the home directory.
func xdgFile(env, fallback, name string) (string, error) {
	dir := os.Getenv(env)
	if !filepath.IsAbs(dir) { // the spec says to ignore relative values
		home, err := os.UserHomeDir()
		if err != nil {
			return "", fmt.Errorf("find home directory: %w", err)
		}
		dir = filepath.Join(home, fallback)
	}
	return filepath.Join(dir, appDirName, name), nil
}

// WriteFileAtomic keeps a crash from leaving half a file: write beside it, then rename over it.
func WriteFileAtomic(path string, data []byte) error {
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, dirMode); err != nil {
		return fmt.Errorf("create %s: %w", dir, err)
	}
	f, err := os.CreateTemp(dir, filepath.Base(path)+".*") // created 0600
	if err != nil {
		return fmt.Errorf("create temporary file: %w", err)
	}
	defer os.Remove(f.Name()) // best effort: after a successful rename the name is gone already
	if _, err := f.Write(data); err != nil {
		_ = f.Close() // the write error is the one to report
		return fmt.Errorf("write %s: %w", f.Name(), err)
	}
	if err := f.Close(); err != nil {
		return fmt.Errorf("close %s: %w", f.Name(), err)
	}
	if err := os.Rename(f.Name(), path); err != nil {
		return fmt.Errorf("replace %s: %w", path, err)
	}
	return nil
}

// readJSON is the file's content when it holds valid JSON; ok is false for a missing or bad file.
func readJSON(path string) (data []byte, ok bool, err error) {
	data, err = os.ReadFile(path)
	if errors.Is(err, fs.ErrNotExist) {
		return nil, false, nil
	}
	if err != nil {
		return nil, false, fmt.Errorf("read %s: %w", path, err)
	}
	return data, json.Valid(data), nil
}
