package web

const (
	distDir = "dist"
	// Nothing from elsewhere and no inline scripts. Angular puts component styles in <style> tags,
	// and the chirp plays from a blob URL.
	contentSecurityPolicy = "default-src 'self'; style-src 'self' 'unsafe-inline'; media-src 'self' blob:"
)
