package hub

import "sync"

// Hub hands every snapshot to the clients that stream them.
type Hub struct {
	mu      sync.Mutex
	clients map[chan string]struct{}
}
