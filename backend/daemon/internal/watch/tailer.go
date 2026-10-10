package watch

import (
	"bytes"
	"errors"
	"io"
	"log/slog"
	"os"

	"claudie/daemon/internal/core"
)

// NewTailer returns a tailer that feeds src.
func NewTailer(src Source) *Tailer {
	return &Tailer{src: src, tails: map[string]*tail{}}
}

// Step reads what the transcripts gained since last time; it reports whether anything changed.
func (t *Tailer) Step() bool {
	refs, err := t.src.Transcripts()
	if err != nil {
		slog.Error("list transcripts", "err", err)
		return false
	}
	changed := false
	listed := make(map[string]bool, len(refs))
	for _, ref := range refs {
		listed[ref.ID] = true
		if t.read(ref) {
			changed = true
		}
	}
	for id := range t.tails {
		if !listed[id] {
			delete(t.tails, id)
		}
	}
	return changed
}

// read feeds the source the new complete lines of one transcript. A file that can't be read is
// skipped quietly: sessions often outlive their transcripts, and the next step tries again.
func (t *Tailer) read(ref core.TranscriptRef) bool {
	f, err := os.Open(ref.Path)
	if err != nil {
		return false
	}
	defer f.Close()
	info, err := f.Stat()
	if err != nil || !info.Mode().IsRegular() {
		return false
	}
	tl := t.position(ref, info.Size())
	if info.Size() == tl.offset {
		return false
	}

	buf := make([]byte, min(info.Size()-tl.offset, maxChunk))
	n, err := f.ReadAt(buf, tl.offset)
	if err != nil && !errors.Is(err, io.EOF) {
		return false
	}
	tl.offset += int64(n)
	return t.feed(ref.ID, tl, buf[:n])
}

// position is where to continue reading ref's file, which is size bytes long now: from the
// start of the window for a file seen the first time, from the start again for one that shrank.
func (t *Tailer) position(ref core.TranscriptRef, size int64) *tail {
	tl := t.tails[ref.ID]
	switch {
	case tl == nil || tl.path != ref.Path:
		start := max(0, size-startBytes)
		tl = &tail{path: ref.Path, offset: start, skip: start > 0}
		t.tails[ref.ID] = tl
	case size < tl.offset:
		*tl = tail{path: ref.Path}
	}
	return tl
}

// feed gives the source every complete line of chunk, and keeps the incomplete last one.
func (t *Tailer) feed(id string, tl *tail, chunk []byte) bool {
	lines := bytes.Split(append(tl.rest, chunk...), []byte("\n"))
	tl.rest = bytes.Clone(lines[len(lines)-1])

	changed := false
	for _, line := range lines[:len(lines)-1] {
		if tl.skip {
			tl.skip = false
			continue
		}
		if len(line) == 0 {
			continue
		}
		ok, err := t.src.Transcript(id, string(line))
		if err != nil {
			slog.Error("feed transcript line", "session", id, "err", err)
		}
		changed = changed || ok
	}
	return changed
}
