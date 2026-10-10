package server

import (
	"encoding/json"
	"io"
	"net/http"
)

// readJSONBody reads a request body of valid JSON; otherwise it answers 400 and reports false.
func readJSONBody(w http.ResponseWriter, r *http.Request) ([]byte, bool) {
	body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, maxBody))
	if err != nil || !json.Valid(body) {
		w.WriteHeader(http.StatusBadRequest)
		return nil, false
	}
	return body, true
}

// writeJSON answers 200 with a body that is JSON already.
func writeJSON(w http.ResponseWriter, body string) {
	w.Header().Set("Content-Type", mimeJSON)
	// The status is sent by now; a failed write means the client left, and there is no one to tell.
	_, _ = io.WriteString(w, body)
}
