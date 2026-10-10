package eventlog_test

import (
	"bytes"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"

	"claudie/daemon/internal/eventlog"
)

func TestWriteAppendsOneLinePerRecordFromManyGoroutines(t *testing.T) {
	var buf bytes.Buffer
	l := eventlog.New(&buf)
	var wg sync.WaitGroup
	for range 20 {
		wg.Go(func() {
			if err := l.Write([]byte(`{"a":1}`)); err != nil {
				t.Error(err)
			}
		})
	}
	wg.Wait()
	if got := buf.String(); got != strings.Repeat("{\"a\":1}\n", 20) {
		t.Errorf("log %q, want 20 whole lines", got)
	}
}

func TestOpenAppendsToTheFile(t *testing.T) {
	path := filepath.Join(t.TempDir(), "events.ndjson")
	for _, line := range []string{"one", "two"} {
		l, err := eventlog.Open(path)
		if err != nil {
			t.Fatal(err)
		}
		if err := l.Write([]byte(line)); err != nil {
			t.Fatal(err)
		}
		if err := l.Close(); err != nil {
			t.Fatal(err)
		}
	}
	data, err := os.ReadFile(path)
	if err != nil || string(data) != "one\ntwo\n" {
		t.Errorf("file %q, %v; want both lines", data, err)
	}
	if info, _ := os.Stat(path); info.Mode().Perm() != 0o600 {
		t.Errorf("mode %v, want 0600", info.Mode().Perm())
	}
}

func TestOpenReportsAFileThatCannotBeCreated(t *testing.T) {
	if _, err := eventlog.Open(filepath.Join(t.TempDir(), "missing", "events.ndjson")); err == nil {
		t.Error("a file in a missing directory was opened")
	}
}
