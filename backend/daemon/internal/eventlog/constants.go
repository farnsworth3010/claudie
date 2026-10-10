package eventlog

import "os"

const (
	fileMode = 0o600
	openFlag = os.O_WRONLY | os.O_APPEND | os.O_CREATE
)
