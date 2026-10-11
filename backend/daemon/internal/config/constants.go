package config

const (
	// DefaultPort is where the daemon listens when CLAUDIE_PORT is unset.
	DefaultPort = 47321
	loopback    = "127.0.0.1" // never listen beyond this machine

	envPort = "CLAUDIE_PORT"
	// envEventLog names a file to append every event to, to replay real sessions in tests.
	// It grows without bound; turn it on only while recording.
	envEventLog = "CLAUDIE_EVENT_LOG"
)
