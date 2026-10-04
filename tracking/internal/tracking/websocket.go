package tracking

import (
	"context"
	"encoding/json"
	"net/http"
	"reflect"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

const maxViewers = 128
const viewerQueueSize = 32

type viewer struct {
	queue chan []byte
	done  chan struct{}
	once  sync.Once
}

func (c *viewer) close() { c.once.Do(func() { close(c.done) }) }

type hub struct {
	mu      sync.Mutex
	viewers map[*viewer]struct{}
	closed  bool
}

func newHub() *hub { return &hub{viewers: make(map[*viewer]struct{})} }
func (h *hub) register() *viewer {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.closed || len(h.viewers) >= maxViewers {
		return nil
	}
	c := &viewer{queue: make(chan []byte, viewerQueueSize), done: make(chan struct{})}
	h.viewers[c] = struct{}{}
	return c
}
func (h *hub) remove(c *viewer) { h.mu.Lock(); delete(h.viewers, c); h.mu.Unlock(); c.close() }
func (h *hub) broadcast(data []byte) {
	h.mu.Lock()
	defer h.mu.Unlock()
	for c := range h.viewers {
		select {
		case <-c.done:
			delete(h.viewers, c)
		case c.queue <- data:
		default:
			c.close()
			delete(h.viewers, c) // never let a slow reader block publishers
		}
	}
}
func (h *hub) close() {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.closed = true
	for c := range h.viewers {
		c.close()
		delete(h.viewers, c)
	}
}

func (s *Service) websocket(w http.ResponseWriter, r *http.Request) {
	// Browsers always send Origin. Native clients explicitly supply the same
	// allowlisted origin; there are no credentials or secrets in the URL.
	if !s.allowedOrigin(r.Header.Get("Origin")) {
		fail(w, http.StatusForbidden, "ORIGIN_FORBIDDEN", "Origin is not allowed")
		return
	}
	if r.URL.RawQuery != "" {
		fail(w, http.StatusBadRequest, "INVALID_REQUEST", "WebSocket URL accepts no query parameters")
		return
	}
	client := s.hub.register()
	if client == nil {
		fail(w, http.StatusServiceUnavailable, "STREAM_CAPACITY", "Live stream is at capacity")
		return
	}
	defer s.hub.remove(client)
	ctx, cancel := context.WithTimeout(r.Context(), redisTimeout)
	snapshot, err := s.snapshot(ctx)
	cancel()
	if err != nil {
		fail(w, http.StatusServiceUnavailable, "DEPENDENCY_UNAVAILABLE", "Vehicle locations are temporarily unavailable")
		return
	}
	upgrader := websocket.Upgrader{ReadBufferSize: 1024, WriteBufferSize: 1024, CheckOrigin: func(req *http.Request) bool { return s.allowedOrigin(req.Header.Get("Origin")) }}
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	defer conn.Close()
	conn.SetReadLimit(1024)
	_ = conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	conn.SetPongHandler(func(string) error { return conn.SetReadDeadline(time.Now().Add(60 * time.Second)) })
	go func() {
		defer client.close()
		for {
			if _, _, err := conn.ReadMessage(); err != nil {
				return
			}
		}
	}()
	initial := struct {
		Type string `json:"type"`
		Snapshot
	}{Type: "vehicle.snapshot", Snapshot: snapshot}
	_ = conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
	if conn.WriteJSON(initial) != nil {
		return
	}
	// Updates that were buffered during bootstrap can precede a position in
	// the snapshot. Drop those duplicates so connecting cannot move backward.
	bootstrap := make(map[string]Position)
	for _, p := range snapshot.Vehicles {
		bootstrap[p.VehicleID] = p
	}
	ping := time.NewTicker(25 * time.Second)
	defer ping.Stop()
	for {
		select {
		case <-client.done:
			return
		case payload := <-client.queue:
			var event locationEvent
			if json.Unmarshal(payload, &event) != nil {
				continue
			}
			if initial, exists := bootstrap[event.VehicleID]; exists {
				if event.ReceivedAt.Before(initial.ReceivedAt) || reflect.DeepEqual(event.Position, initial) {
					continue
				}
				delete(bootstrap, event.VehicleID)
			}
			_ = conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if conn.WriteMessage(websocket.TextMessage, payload) != nil {
				return
			}
		case <-ping.C:
			if conn.WriteControl(websocket.PingMessage, nil, time.Now().Add(10*time.Second)) != nil {
				return
			}
		}
	}
}
