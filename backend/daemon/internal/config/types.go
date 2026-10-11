package config

// Config is what the environment sets.
type Config struct {
	Port         int
	EventLogPath string // "": no event log
}
