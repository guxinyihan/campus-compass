package tracking

import (
	"context"
	"encoding/json"
	"errors"
	"sort"
	"time"

	"github.com/redis/go-redis/v9"
)

type Position struct {
	VehicleID  string    `json:"vehicleId"`
	Lat        float64   `json:"lat"`
	Lng        float64   `json:"lng"`
	ReceivedAt time.Time `json:"receivedAt"`
	Heading    *float64  `json:"heading,omitempty"`
	Accuracy   *float64  `json:"accuracy,omitempty"`
}

type locationEvent struct {
	Type string `json:"type"`
	Position
}

type Snapshot struct {
	Vehicles          []Position `json:"vehicles"`
	StaleAfterSeconds float64    `json:"staleAfterSeconds"`
	TTLSeconds        float64    `json:"ttlSeconds"`
}

// Lua preserves update/event order across simultaneous publishers. Only current
// location is retained; there is no list, stream, sorted set, or history table.
var publishScript = redis.NewScript(`
redis.call('SET', KEYS[1], ARGV[1], 'PX', ARGV[3])
redis.call('PUBLISH', ARGV[4], ARGV[2])
return 1
`)

func (s *Service) key(id string) string { return s.cfg.KeyPrefix + "vehicle:" + id + ":latest" }
func (s *Service) channel() string      { return s.cfg.KeyPrefix + "campuscompass:vehicle.location" }

func (s *Service) save(ctx context.Context, p Position) error {
	value, err := json.Marshal(p)
	if err != nil {
		return err
	}
	event, err := json.Marshal(locationEvent{Type: "vehicle.location", Position: p})
	if err != nil {
		return err
	}
	return publishScript.Run(ctx, s.redis, []string{s.key(p.VehicleID)}, string(value), string(event), s.cfg.TTL.Milliseconds(), s.channel()).Err()
}

func (s *Service) latest(ctx context.Context, id string) (Position, error) {
	raw, err := s.redis.Get(ctx, s.key(id)).Bytes()
	if err != nil {
		return Position{}, err
	}
	var p Position
	if err := json.Unmarshal(raw, &p); err != nil {
		return Position{}, err
	}
	if p.VehicleID != id || !validPosition(p) {
		return Position{}, errors.New("invalid broker position")
	}
	return p, nil
}

func (s *Service) snapshot(ctx context.Context) (Snapshot, error) {
	positions := make([]Position, 0)
	seen := make(map[string]bool)
	iter := s.redis.Scan(ctx, 0, s.cfg.KeyPrefix+"vehicle:*:latest", 100).Iterator()
	for iter.Next(ctx) {
		key := iter.Val()
		if seen[key] {
			continue
		}
		seen[key] = true
		if len(seen) > 1000 {
			return Snapshot{}, errors.New("vehicle snapshot limit exceeded")
		}
		raw, err := s.redis.Get(ctx, key).Bytes()
		if errors.Is(err, redis.Nil) {
			continue
		} // key may expire during scan
		if err != nil {
			return Snapshot{}, err
		}
		var p Position
		if err := json.Unmarshal(raw, &p); err != nil {
			return Snapshot{}, err
		}
		if !validPosition(p) || key != s.key(p.VehicleID) {
			return Snapshot{}, errors.New("invalid broker position")
		}
		positions = append(positions, p)
	}
	if err := iter.Err(); err != nil {
		return Snapshot{}, err
	}
	sort.Slice(positions, func(i, j int) bool { return positions[i].VehicleID < positions[j].VehicleID })
	return Snapshot{Vehicles: positions, StaleAfterSeconds: s.cfg.StaleAfter.Seconds(), TTLSeconds: s.cfg.TTL.Seconds()}, nil
}
