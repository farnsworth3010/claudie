package web_test

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"claudie/daemon/internal/web"
)

func TestTheRootIsThePage(t *testing.T) {
	rec := httptest.NewRecorder()
	web.Handler().ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("GET / = %d, want 200", rec.Code)
	}
	if ct := rec.Header().Get("Content-Type"); !strings.HasPrefix(ct, "text/html") {
		t.Errorf("Content-Type %q, want text/html", ct)
	}
	if !strings.Contains(rec.Body.String(), "<app-root>") {
		t.Error("the page has no <app-root>")
	}
}

func TestThePageKeepsToItsOwnScripts(t *testing.T) {
	rec := httptest.NewRecorder()
	web.Handler().ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/", nil))
	csp := rec.Header().Get("Content-Security-Policy")
	if !strings.Contains(csp, "default-src 'self'") || strings.Contains(csp, "script-src") {
		t.Errorf("Content-Security-Policy %q: scripts must come from the daemon only", csp)
	}
}

func TestAnUnknownFileIsNotFound(t *testing.T) {
	rec := httptest.NewRecorder()
	web.Handler().ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/nothing.js", nil))
	if rec.Code != http.StatusNotFound {
		t.Errorf("GET /nothing.js = %d, want 404", rec.Code)
	}
}
