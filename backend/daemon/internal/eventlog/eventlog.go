// Package eventlog records every hook event in a file, to replay real sessions in tests.
package eventlog

import (
	"fmt"
	"io"
	"os"
)

// New returns a log that writes to out.
func New(out io.Writer) *Log {
	return &Log{out: out}
}

// Open returns a log that appends to the file at path, creating it.
func Open(path string) (*Log, error) {
	f, err := os.OpenFile(path, openFlag, fileMode)
	if err != nil {
		return nil, fmt.Errorf("open event log: %w", err)
	}
	return New(f), nil
}

// Write appends line and a newline.
func (l *Log) Write(line []byte) error {
	l.mu.Lock()
	defer l.mu.Unlock()
	_, err := l.out.Write(append(line, '\n'))
	return err
}

// Close closes the file behind the log, if there is one.
func (l *Log) Close() error {
	l.mu.Lock()
	defer l.mu.Unlock()
	if c, ok := l.out.(io.Closer); ok {
		return c.Close()
	}
	return nil
}
