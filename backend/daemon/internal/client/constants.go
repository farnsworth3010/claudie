package client

import (
	"net/http"
	"time"
)

const (
	versionPath = "/version"
	quitPath    = "/quit"
	mimeJSON    = "application/json"
	timeout     = 2 * time.Second
)

var httpClient = &http.Client{Timeout: timeout}
