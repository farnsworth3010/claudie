package store_test

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"claudie/daemon/internal/store"
)

func TestSaverWritesOncePerIntervalNoMatterHowManyChanges(t *testing.T) {
	path := filepath.Join(t.TempDir(), "sessions.json")
	sv := store.NewSaver(coreWithSession(t), path, 20*time.Millisecond)

	sv.Touch()
	sv.Touch()
	if _, err := os.Stat(path); err == nil {
		t.Fatal("written before the interval passed")
	}
	deadline := time.Now().Add(5 * time.Second)
	for {
		data, err := os.ReadFile(path)
		if err == nil {
			if !strings.Contains(string(data), `"thinking"`) {
				t.Fatalf("saved %s, want the latest state", data)
			}
			return
		}
		if time.Now().After(deadline) {
			t.Fatal("nothing was saved")
		}
		time.Sleep(5 * time.Millisecond)
	}
}

func TestSaverStopWritesTheLatestStateAndStaysQuiet(t *testing.T) {
	path := filepath.Join(t.TempDir(), "sessions.json")
	sv := store.NewSaver(coreWithSession(t), path, 20*time.Millisecond)

	sv.Touch()
	if err := sv.Stop(); err != nil {
		t.Fatal(err)
	}
	if data, err := os.ReadFile(path); err != nil || !strings.Contains(string(data), `"thinking"`) {
		t.Fatalf("saved %s, %v; want the latest state", data, err)
	}

	// A stopped saver writes nothing more, however long it waits.
	if err := os.Remove(path); err != nil {
		t.Fatal(err)
	}
	sv.Touch()
	time.Sleep(100 * time.Millisecond)
	if _, err := os.Stat(path); err == nil {
		t.Error("a stopped saver wrote again")
	}
}

func TestSaverStopWritesWithoutWaitingForTheInterval(t *testing.T) {
	path := filepath.Join(t.TempDir(), "sessions.json")
	sv := store.NewSaver(coreWithSession(t), path, time.Hour)
	sv.Touch()
	if _, err := os.Stat(path); err == nil {
		t.Fatal("written before the interval passed")
	}
	if err := sv.Stop(); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(path); err != nil {
		t.Errorf("Stop wrote nothing: %v", err)
	}
}

func TestFlushReportsAFileThatCannotBeWritten(t *testing.T) {
	blocker := filepath.Join(t.TempDir(), "file")
	writeFile(t, blocker, "x")
	sv := store.NewSaver(coreWithSession(t), filepath.Join(blocker, "sessions.json"), time.Hour)
	if err := sv.Flush(); err == nil {
		t.Error("a write under a file was reported as done")
	}
}
