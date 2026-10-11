package config_test

import (
	"testing"

	"claudie/daemon/internal/config"
)

// env is a getenv over a fixed set of variables.
func env(vars map[string]string) func(string) string {
	return func(k string) string { return vars[k] }
}

func TestLoadReadsThePort(t *testing.T) {
	tests := []struct {
		in      string
		want    int
		wantErr bool
	}{
		{"", config.DefaultPort, false},
		{"8080", 8080, false},
		{"1", 1, false},
		{"65535", 65535, false},
		{"0", 0, true},
		{"65536", 0, true},
		{"-1", 0, true},
		{"abc", 0, true},
	}
	for _, tt := range tests {
		t.Run(tt.in, func(t *testing.T) {
			got, err := config.Load(env(map[string]string{"CLAUDIE_PORT": tt.in}))
			if (err != nil) != tt.wantErr || got.Port != tt.want {
				t.Errorf("port %d, error %v; want %d, error %v", got.Port, err, tt.want, tt.wantErr)
			}
		})
	}
}

func TestLoad(t *testing.T) {
	got, err := config.Load(env(map[string]string{"CLAUDIE_PORT": "47399", "CLAUDIE_EVENT_LOG": "/tmp/e.ndjson"}))
	if err != nil {
		t.Fatal(err)
	}
	if got.Port != 47399 || got.EventLogPath != "/tmp/e.ndjson" || got.Addr() != "127.0.0.1:47399" {
		t.Errorf("config %+v, addr %s", got, got.Addr())
	}
	if got, err := config.Load(env(nil)); err != nil || got.Port != config.DefaultPort || got.EventLogPath != "" {
		t.Errorf("empty environment: %+v, %v; want the defaults", got, err)
	}
}

func TestHostsAreTheNamesOfThisMachineWithThePort(t *testing.T) {
	got := config.Config{Port: 47399}.Hosts()
	if len(got) != 2 || got[0] != "127.0.0.1:47399" || got[1] != "localhost:47399" {
		t.Errorf("hosts %v", got)
	}
}
