package server

import (
	"net/http"
	"slices"
	"strings"
)

// guard turns away web pages: any site can make the browser send requests to localhost. A
// foreign Host means DNS rebinding, a foreign Origin a cross-site request; and requiring JSON
// on POST forces a CORS preflight, which we never answer.
func (s *Server) guard(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !s.knownHost(r.Host) || !s.knownOrigin(r.Header.Get("Origin")) {
			w.WriteHeader(http.StatusForbidden)
			return
		}
		if r.Method == http.MethodPost && !strings.HasPrefix(r.Header.Get("Content-Type"), mimeJSON) {
			w.WriteHeader(http.StatusUnsupportedMediaType)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// knownHost tells whether host is one the daemon answers to.
func (s *Server) knownHost(host string) bool {
	return slices.Contains(s.hosts, host)
}

// knownOrigin tells whether a request's Origin is none (not a browser) or ours.
func (s *Server) knownOrigin(origin string) bool {
	if origin == "" {
		return true
	}
	host := strings.TrimPrefix(strings.TrimPrefix(origin, "http://"), "https://")
	return s.knownHost(host)
}
