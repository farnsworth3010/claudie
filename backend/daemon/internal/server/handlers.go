package server

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"strconv"

	"claudie/daemon/internal/eventlog"
	"claudie/daemon/internal/store"
)

// hook takes one Claude Code event; the pid is in the pid header when the sender knows it.
func (s *Server) hook(w http.ResponseWriter, r *http.Request) {
	body, ok := readJSONBody(w, r)
	if !ok {
		return
	}
	pid, _ := strconv.Atoi(r.Header.Get(pidHeader)) // absent or malformed: the pid is unknown
	if s.repeats.Repeat(body, pid, s.now()) {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	line, err := json.Marshal(eventlog.Record{Received: s.now().UnixMilli(), Pid: pid, Event: body})
	if err != nil {
		slog.Error("encode event", "err", err)
		w.WriteHeader(http.StatusInternalServerError)
		return
	}
	if s.log != nil {
		if err := s.log.Write(line); err != nil {
			slog.Warn("write event log", "err", err)
		}
	}
	changed, err := s.core.Hook(line)
	if err != nil {
		slog.Error("apply hook", "err", err)
		w.WriteHeader(http.StatusInternalServerError)
		return
	}
	if changed {
		s.changed()
	}
	// An empty 2xx is what Claude Code's http hooks read as "carry on".
	w.WriteHeader(http.StatusNoContent)
}

// state answers with the current snapshot.
func (s *Server) state(w http.ResponseWriter, _ *http.Request) {
	snap, err := s.snapshot()
	if err != nil {
		slog.Error("snapshot", "err", err)
		w.WriteHeader(http.StatusInternalServerError)
		return
	}
	writeJSON(w, snap)
}

// getSettings answers with the overlay settings.
func (s *Server) getSettings(w http.ResponseWriter, _ *http.Request) {
	settings, err := s.core.Settings()
	if err != nil {
		slog.Error("read settings", "err", err)
		w.WriteHeader(http.StatusInternalServerError)
		return
	}
	writeJSON(w, settings)
}

// postSettings applies a JSON patch of the settings and answers with the settings after it.
func (s *Server) postSettings(w http.ResponseWriter, r *http.Request) {
	body, ok := readJSONBody(w, r)
	if !ok {
		return
	}
	s.settingsMu.Lock()
	defer s.settingsMu.Unlock()
	before, err := s.core.Settings()
	if err != nil {
		slog.Error("read settings", "err", err)
		w.WriteHeader(http.StatusInternalServerError)
		return
	}
	after, ok, err := s.core.UpdateSettings(string(body))
	if err != nil {
		slog.Error("update settings", "err", err)
		w.WriteHeader(http.StatusInternalServerError)
		return
	}
	if !ok {
		w.WriteHeader(http.StatusBadRequest)
		return
	}
	if after != before {
		if s.settingsPath != "" {
			if err := store.WriteFileAtomic(s.settingsPath, []byte(after)); err != nil {
				slog.Error("save settings", "err", err)
			}
		}
		s.changed()
	}
	writeJSON(w, after)
}

// getVersion answers with the daemon's version.
func (s *Server) getVersion(w http.ResponseWriter, _ *http.Request) {
	body, err := json.Marshal(map[string]string{"version": s.version})
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		return
	}
	writeJSON(w, string(body))
}

// postQuit stops the daemon once the answer is sent.
func (s *Server) postQuit(w http.ResponseWriter, _ *http.Request) {
	if s.quit == nil {
		w.WriteHeader(http.StatusForbidden)
		return
	}
	w.WriteHeader(http.StatusAccepted)
	slog.Info("asked to quit")
	go s.quit()
}
