package store

import "time"

const (
	// SaveEvery is the longest the saved sessions lag behind the live ones.
	SaveEvery = time.Second

	dirMode = 0o700

	appDirName         = "claudie"
	envStateHome       = "XDG_STATE_HOME"
	stateHomeFallback  = ".local/state"
	sessionsFileName   = "sessions.json"
	logFileName        = "daemon.log"
	envConfigHome      = "XDG_CONFIG_HOME"
	configHomeFallback = ".config"
	settingsFileName   = "settings.json"
)
