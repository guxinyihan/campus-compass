package tracking

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"math"
	"mime"
	"net/http"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
)

const redisTimeout = 3 * time.Second

type Service struct {
	cfg     Config
	redis   *redis.Client
	hub     *hub
	pubsub  *redis.PubSub
	cancel  context.CancelFunc
	stopped chan struct{}
}

// New subscribes before accepting requests, so accepted writes have a broker
// consumer. Redis is the shared source of truth even with multiple Go instances.
func New(cfg Config, client *redis.Client) (*Service, error) {
	if err := cfg.Validate(); err != nil {
		return nil, err
	}
	ctx, cancel := context.WithCancel(context.Background())
	s := &Service{cfg: cfg, redis: client, hub: newHub(), cancel: cancel, stopped: make(chan struct{})}
	s.pubsub = client.Subscribe(ctx, s.channel())
	readyCtx, readyCancel := context.WithTimeout(ctx, redisTimeout)
	defer readyCancel()
	if _, err := s.pubsub.Receive(readyCtx); err != nil {
		cancel()
		_ = s.pubsub.Close()
		return nil, errors.New("tracking broker unavailable")
	}
	go func() {
		defer close(s.stopped)
		messages := s.pubsub.Channel(redis.WithChannelSize(128))
		for {
			select {
			case <-ctx.Done():
				return
			case msg, ok := <-messages:
				if !ok {
					return
				}
				// The broker is private, but public output is still allowlisted.
				var event locationEvent
				if json.Unmarshal([]byte(msg.Payload), &event) != nil || event.Type != "vehicle.location" || !validPosition(event.Position) {
					continue
				}
				encoded, err := json.Marshal(event)
				if err == nil {
					s.hub.broadcast(encoded)
				}
			}
		}
	}()
	return s, nil
}

func (s *Service) Close() { s.cancel(); _ = s.pubsub.Close(); s.hub.close(); <-s.stopped }

func (s *Service) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /live", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})
	mux.HandleFunc("GET /health", s.health)
	mux.HandleFunc("GET /api/v1/vehicles", s.vehicles)
	mux.HandleFunc("GET /api/v1/vehicles/{vehicleId}", s.vehicle)
	mux.HandleFunc("POST /api/v1/vehicles/{vehicleId}/location", s.publish)
	mux.HandleFunc("GET /ws/vehicles", s.websocket)
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		fail(w, http.StatusNotFound, "NOT_FOUND", "Endpoint not found")
	})
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		origin := r.Header.Get("Origin")
		if origin != "" {
			if !s.allowedOrigin(origin) {
				fail(w, http.StatusForbidden, "ORIGIN_FORBIDDEN", "Origin is not allowed")
				return
			}
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Add("Vary", "Origin")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		}
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		mux.ServeHTTP(w, r)
	})
}

func (s *Service) allowedOrigin(origin string) bool {
	for _, allowed := range s.cfg.Origins {
		if origin == strings.TrimSpace(allowed) {
			return true
		}
	}
	return false
}

func (s *Service) health(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), redisTimeout)
	defer cancel()
	if s.redis.Ping(ctx).Err() != nil {
		fail(w, http.StatusServiceUnavailable, "DEPENDENCY_UNAVAILABLE", "Tracking broker is unavailable")
		return
	}
	select {
	case <-s.stopped:
		fail(w, http.StatusServiceUnavailable, "DEPENDENCY_UNAVAILABLE", "Tracking stream is unavailable")
		return
	default:
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok", "redis": "ok"})
}

func (s *Service) vehicles(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), redisTimeout)
	defer cancel()
	snapshot, err := s.snapshot(ctx)
	if err != nil {
		fail(w, http.StatusServiceUnavailable, "DEPENDENCY_UNAVAILABLE", "Vehicle locations are temporarily unavailable")
		return
	}
	writeJSON(w, http.StatusOK, snapshot)
}

func (s *Service) vehicle(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("vehicleId")
	if !vehicleIDPattern.MatchString(id) {
		fail(w, http.StatusBadRequest, "INVALID_VEHICLE", "Invalid vehicle ID")
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), redisTimeout)
	defer cancel()
	position, err := s.latest(ctx, id)
	if errors.Is(err, redis.Nil) {
		fail(w, http.StatusNotFound, "LOCATION_NOT_FOUND", "Vehicle has no current location")
		return
	}
	if err != nil {
		fail(w, http.StatusServiceUnavailable, "DEPENDENCY_UNAVAILABLE", "Vehicle location is temporarily unavailable")
		return
	}
	writeJSON(w, http.StatusOK, position)
}

type publishInput struct {
	Lat      *float64 `json:"lat"`
	Lng      *float64 `json:"lng"`
	Heading  *float64 `json:"heading,omitempty"`
	Accuracy *float64 `json:"accuracy,omitempty"`
}

func (s *Service) publish(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("vehicleId")
	if !vehicleIDPattern.MatchString(id) {
		fail(w, http.StatusBadRequest, "INVALID_VEHICLE", "Invalid vehicle ID")
		return
	}
	if status, err := s.authorize(r, id); err != nil {
		fail(w, status, "TRACKING_AUTHORIZATION_REQUIRED", err.Error())
		return
	}
	contentType, _, err := mime.ParseMediaType(r.Header.Get("Content-Type"))
	if err != nil || contentType != "application/json" {
		fail(w, http.StatusUnsupportedMediaType, "JSON_REQUIRED", "Use application/json")
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, 1024)
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	var input publishInput
	if decoder.Decode(&input) != nil || decoder.Decode(new(any)) != io.EOF || input.Lat == nil || input.Lng == nil {
		fail(w, http.StatusBadRequest, "INVALID_LOCATION", "Send only lat, lng, optional heading and accuracy")
		return
	}
	position := Position{VehicleID: id, Lat: *input.Lat, Lng: *input.Lng, Heading: input.Heading, Accuracy: input.Accuracy, ReceivedAt: time.Now().UTC()}
	if !validPosition(position) {
		fail(w, http.StatusBadRequest, "INVALID_LOCATION", "Location must be inside campus with valid heading and accuracy")
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), redisTimeout)
	defer cancel()
	if err := s.save(ctx, position); err != nil {
		fail(w, http.StatusServiceUnavailable, "DEPENDENCY_UNAVAILABLE", "Location could not be accepted")
		return
	}
	writeJSON(w, http.StatusOK, position)
}

func validPosition(p Position) bool {
	if !vehicleIDPattern.MatchString(p.VehicleID) || p.ReceivedAt.IsZero() {
		return false
	}
	if !finite(p.Lat) || !finite(p.Lng) || p.Lat < 30.3491 || p.Lat > 30.3598 || p.Lng < 76.3572 || p.Lng > 76.37529 {
		return false
	}
	if p.Heading != nil && (!finite(*p.Heading) || *p.Heading < 0 || *p.Heading >= 360) {
		return false
	}
	if p.Accuracy != nil && (!finite(*p.Accuracy) || *p.Accuracy < 0 || *p.Accuracy > 5000) {
		return false
	}
	return true
}

func finite(value float64) bool { return !math.IsNaN(value) && !math.IsInf(value, 0) }

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func fail(w http.ResponseWriter, status int, code, message string) {
	writeJSON(w, status, map[string]any{"error": map[string]string{"code": code, "message": message}})
}
