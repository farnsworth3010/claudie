package watch

import "claudie/daemon/internal/core"

// Source is the session logic as the tailer uses it; *core.Core implements it.
type Source interface {
	// Transcripts lists the sessions whose transcript files should be tailed.
	Transcripts() ([]core.TranscriptRef, error)
	// Transcript feeds one line of session id's transcript; it reports whether anything changed.
	Transcript(id, line string) (bool, error)
}

// tail is how far a transcript file has been read.
type tail struct {
	path   string
	offset int64
	rest   []byte // an incomplete last line, waiting for its end
	skip   bool   // the first line is cut off: we started mid-file
}

// Tailer feeds the source what sessions write to their transcript files: denied permissions and
// Esc leave no hook, only a line there. Polling rather than inotify: /clear swaps the file.
// Not safe for concurrent use; one goroutine calls Step.
type Tailer struct {
	src   Source
	tails map[string]*tail // by session id
}
