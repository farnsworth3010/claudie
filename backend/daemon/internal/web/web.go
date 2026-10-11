// Package web serves the settings page: frontends/web, built into dist/ by `pnpm build`.
package web

import (
	"embed"
	"io/fs"
	"net/http"
)

//go:embed dist
var dist embed.FS

// Handler serves the page's files, index.html at the root.
func Handler() http.Handler {
	files, err := fs.Sub(dist, distDir)
	if err != nil {
		panic(err) // the embedded tree is fixed at build time
	}
	server := http.FileServerFS(files)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Security-Policy", contentSecurityPolicy)
		w.Header().Set("Cache-Control", "no-cache") // a newer daemon's page replaces a cached one
		server.ServeHTTP(w, r)
	})
}
