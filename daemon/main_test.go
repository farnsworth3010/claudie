package main

import "testing"

func TestPortFrom(t *testing.T) {
	tests := []struct {
		in      string
		want    int
		wantErr bool
	}{
		{"", defaultPort, false},
		{"8080", 8080, false},
		{"0", 0, true},
		{"65536", 0, true},
		{"abc", 0, true},
	}
	for _, tt := range tests {
		got, err := portFrom(tt.in)
		if (err != nil) != tt.wantErr || got != tt.want {
			t.Errorf("portFrom(%q) = %d, %v; want %d, error %v", tt.in, got, err, tt.want, tt.wantErr)
		}
	}
}
