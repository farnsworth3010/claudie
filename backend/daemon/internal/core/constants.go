package core

// apiNames are the functions core.js must export on its claudie object.
var apiNames = []string{
	"hook", "transcript", "tick", "transcripts", "count", "snapshot",
	"save", "restore", "settings", "loadSettings", "updateSettings", "limits",
}

const globalName = "claudie"
