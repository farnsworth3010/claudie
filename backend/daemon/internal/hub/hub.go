// Package hub fans session snapshots out to the clients that stream them.
package hub

import "log/slog"

// New returns a hub without clients.
func New() *Hub {
	return &Hub{clients: map[chan string]struct{}{}}
}

// Subscribe returns a client's channel of snapshots and the function that ends the subscription.
// One pending snapshot per client is enough: each one holds the whole state. A non-nil snapshot
// is taken under the lock and queued as the client's first, so that no Publish that began
// before the subscription can land after it.
func (h *Hub) Subscribe(snapshot func() (string, error)) (updates <-chan string, cancel func()) {
	c := make(chan string, 1)
	h.mu.Lock()
	defer h.mu.Unlock()
	if snapshot != nil {
		if snap, err := snapshot(); err != nil {
			slog.Error("snapshot", "err", err)
		} else {
			c <- snap
		}
	}
	h.clients[c] = struct{}{}
	return c, func() {
		h.mu.Lock()
		delete(h.clients, c)
		h.mu.Unlock()
	}
}

// Publish takes a snapshot and sends it to every client, replacing one it hasn't taken yet. The
// snapshot is taken under the lock, so concurrent publishes reach the clients in the order the
// state was read, never an older state after a newer one. The lock order is hub, then core; the
// core never takes the hub's lock. Publish is the only sender and holds the lock, so neither the
// drain nor the send can block.
func (h *Hub) Publish(snapshot func() (string, error)) error {
	h.mu.Lock()
	defer h.mu.Unlock()
	snap, err := snapshot()
	if err != nil {
		return err
	}
	for c := range h.clients {
		select {
		case <-c:
		default:
		}
		c <- snap
	}
	return nil
}
