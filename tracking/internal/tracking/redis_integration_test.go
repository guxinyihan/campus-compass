package tracking

import (
	"context"
	"fmt"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/redis/go-redis/v9"
)

// Set TRACKING_TEST_REDIS_ADDR to run against a disposable actual Redis. This
// never FLUSHDBs or alters unrelated keys; the per-run namespace is cleaned up.
func TestActualRedisLuaTTLAndWebSocket(t *testing.T) {
	addr := os.Getenv("TRACKING_TEST_REDIS_ADDR")
	if addr == "" {
		t.Skip("set TRACKING_TEST_REDIS_ADDR for actual Redis integration")
	}
	cfg := testConfig()
	cfg.KeyPrefix = fmt.Sprintf("test:campuscompass:%d:", time.Now().UnixNano())
	client := redis.NewClient(&redis.Options{Addr: addr, Protocol: 2, DisableIndentity: true, DialTimeout: 2 * time.Second, ReadTimeout: 2 * time.Second, WriteTimeout: 2 * time.Second})
	t.Cleanup(func() {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		iter := client.Scan(ctx, 0, cfg.KeyPrefix+"*", 100).Iterator()
		for iter.Next(ctx) {
			_ = client.Del(ctx, iter.Val()).Err()
		}
		_ = client.Close()
	})
	info, err := client.Info(context.Background(), "server").Result()
	if err != nil {
		t.Fatal(err)
	}
	for _, line := range strings.Split(info, "\n") {
		if strings.HasPrefix(line, "redis_version:") {
			t.Log(strings.TrimSpace(line))
		}
	}
	s, err := New(cfg, client)
	if err != nil {
		t.Fatal(err)
	}
	srv := httptest.NewServer(s.Handler())
	t.Cleanup(func() { s.Close(); srv.Close() })
	conn := connect(t, srv.URL)
	readEvent(t, conn)
	resp, _ := post(t, srv.URL, "demo-real", grant(t, "demo-real"), `{"lat":30.353,"lng":76.365}`)
	if resp.StatusCode != 200 {
		t.Fatal(resp.StatusCode)
	}
	event := readEvent(t, conn)
	p, err := s.latest(context.Background(), "demo-real")
	if err != nil || event["vehicleId"] != p.VehicleID || event["receivedAt"] != p.ReceivedAt.Format(time.RFC3339Nano) {
		t.Fatalf("atomic Redis/event failed: %v %+v %v", event, p, err)
	}
	ttl, err := client.PTTL(context.Background(), s.key("demo-real")).Result()
	if err != nil || ttl < 115*time.Second || ttl > 120*time.Second {
		t.Fatalf("TTL=%v err=%v", ttl, err)
	}
	resp, _ = post(t, srv.URL, "demo-other", grant(t, "demo-real"), `{"lat":30.353,"lng":76.365}`)
	if resp.StatusCode != 403 {
		t.Fatal(resp.StatusCode)
	}
	if exists := client.Exists(context.Background(), s.key("demo-other")).Val(); exists != 0 {
		t.Fatal("cross-vehicle write created key")
	}
	// Expiration itself is observed on the real server, without a 120s sleep.
	if err := client.PExpire(context.Background(), s.key("demo-real"), 25*time.Millisecond).Err(); err != nil {
		t.Fatal(err)
	}
	deadline := time.Now().Add(time.Second)
	for client.Exists(context.Background(), s.key("demo-real")).Val() != 0 && time.Now().Before(deadline) {
		time.Sleep(5 * time.Millisecond)
	}
	view, err := s.snapshot(context.Background())
	if err != nil || len(view.Vehicles) != 0 {
		t.Fatalf("expired snapshot=%+v err=%v", view, err)
	}
}
