package tracking

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/golang-jwt/jwt/v5"
	"github.com/gorilla/websocket"
	"github.com/redis/go-redis/v9"
)

const testSecret = "a-disposable-test-tracking-key-at-least-32-characters"
const testOrigin = "http://localhost:5173"

func testConfig() Config {
	return Config{Addr: ":8081", Secret: testSecret, Origins: []string{testOrigin}, TTL: 120 * time.Second, StaleAfter: 30 * time.Second}
}

func harness(t *testing.T) (*Service, *miniredis.Miniredis, *httptest.Server) {
	t.Helper()
	mr := miniredis.RunT(t)
	client := redis.NewClient(&redis.Options{Addr: mr.Addr(), Protocol: 2, DisableIndentity: true})
	s, err := New(testConfig(), client)
	if err != nil {
		t.Fatal(err)
	}
	srv := httptest.NewServer(s.Handler())
	t.Cleanup(func() { s.Close(); srv.Close(); _ = client.Close() })
	return s, mr, srv
}

func validClaims(id string) trackingClaims {
	now := time.Now().Truncate(time.Second)
	return trackingClaims{Role: "driver", VehicleID: id, TokenType: "tracking", RegisteredClaims: jwt.RegisteredClaims{Subject: "fake-driver-id", Issuer: "campuscompass-api", Audience: jwt.ClaimStrings{"campuscompass-tracking"}, IssuedAt: jwt.NewNumericDate(now), ExpiresAt: jwt.NewNumericDate(now.Add(120 * time.Second))}}
}

func signed(t *testing.T, claims trackingClaims, method jwt.SigningMethod, secret string) string {
	t.Helper()
	token, err := jwt.NewWithClaims(method, claims).SignedString([]byte(secret))
	if err != nil {
		t.Fatal(err)
	}
	return token
}

func grant(t *testing.T, id string) string {
	return signed(t, validClaims(id), jwt.SigningMethodHS256, testSecret)
}

func post(t *testing.T, base, id, token, body string) (*http.Response, []byte) {
	t.Helper()
	req, err := http.NewRequest(http.MethodPost, base+"/api/v1/vehicles/"+id+"/location", strings.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatal(err)
	}
	return resp, raw
}

func connect(t *testing.T, base string) *websocket.Conn {
	t.Helper()
	header := http.Header{"Origin": []string{testOrigin}}
	conn, _, err := websocket.DefaultDialer.Dial("ws"+strings.TrimPrefix(base, "http")+"/ws/vehicles", header)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = conn.Close() })
	return conn
}

func readEvent(t *testing.T, conn *websocket.Conn) map[string]any {
	t.Helper()
	_ = conn.SetReadDeadline(time.Now().Add(3 * time.Second))
	var result map[string]any
	if err := conn.ReadJSON(&result); err != nil {
		t.Fatal(err)
	}
	return result
}

func TestAuthorizedWriteSnapshotAndTTL(t *testing.T) {
	s, mr, srv := harness(t)
	resp, raw := post(t, srv.URL, "demo-a", grant(t, "demo-a"), `{"lat":30.353,"lng":76.365,"heading":90,"accuracy":8}`)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status %d: %s", resp.StatusCode, raw)
	}
	var p Position
	if err := json.Unmarshal(raw, &p); err != nil {
		t.Fatal(err)
	}
	if p.VehicleID != "demo-a" || time.Since(p.ReceivedAt) > 3*time.Second || p.Heading == nil || *p.Heading != 90 {
		t.Fatalf("unexpected position: %+v", p)
	}
	if got := mr.TTL(s.key("demo-a")); got != 120*time.Second {
		t.Fatalf("TTL=%v", got)
	}
	if len(mr.Keys()) != 1 {
		t.Fatalf("latest only, keys=%v", mr.Keys())
	}
	mr.FastForward(31 * time.Second)
	view, err := s.snapshot(context.Background())
	if err != nil || len(view.Vehicles) != 1 || view.StaleAfterSeconds != 30 || view.TTLSeconds != 120 {
		t.Fatalf("snapshot=%+v err=%v", view, err)
	}
	mr.FastForward(90 * time.Second)
	view, err = s.snapshot(context.Background())
	if err != nil || len(view.Vehicles) != 0 {
		t.Fatalf("expired snapshot=%+v err=%v", view, err)
	}
	response, err := http.Get(srv.URL + "/api/v1/vehicles/demo-a")
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusNotFound {
		t.Fatalf("expired vehicle status=%d", response.StatusCode)
	}
}

func TestDriverAuthorizationRejectsUnsafeClaimsWithoutWrites(t *testing.T) {
	_, mr, srv := harness(t)
	cases := []struct {
		name   string
		mutate func(*trackingClaims)
		method jwt.SigningMethod
		secret string
		status int
	}{
		{"other vehicle", func(c *trackingClaims) { c.VehicleID = "demo-b" }, jwt.SigningMethodHS256, testSecret, 403},
		{"student", func(c *trackingClaims) { c.Role = "student" }, jwt.SigningMethodHS256, testSecret, 403},
		{"access token", func(c *trackingClaims) { c.TokenType = "access" }, jwt.SigningMethodHS256, testSecret, 401},
		{"expired", func(c *trackingClaims) {
			c.IssuedAt = jwt.NewNumericDate(time.Now().Add(-121 * time.Second))
			c.ExpiresAt = jwt.NewNumericDate(time.Now().Add(-time.Second))
		}, jwt.SigningMethodHS256, testSecret, 401},
		{"future", func(c *trackingClaims) {
			c.IssuedAt = jwt.NewNumericDate(time.Now().Add(time.Minute))
			c.ExpiresAt = jwt.NewNumericDate(time.Now().Add(2 * time.Minute))
		}, jwt.SigningMethodHS256, testSecret, 401},
		{"long lifetime", func(c *trackingClaims) { c.ExpiresAt = jwt.NewNumericDate(c.IssuedAt.Add(121 * time.Second)) }, jwt.SigningMethodHS256, testSecret, 401},
		{"missing iat", func(c *trackingClaims) { c.IssuedAt = nil }, jwt.SigningMethodHS256, testSecret, 401},
		{"missing exp", func(c *trackingClaims) { c.ExpiresAt = nil }, jwt.SigningMethodHS256, testSecret, 401},
		{"missing subject", func(c *trackingClaims) { c.Subject = "" }, jwt.SigningMethodHS256, testSecret, 401},
		{"wrong issuer", func(c *trackingClaims) { c.Issuer = "someone-else" }, jwt.SigningMethodHS256, testSecret, 401},
		{"wrong audience", func(c *trackingClaims) { c.Audience = jwt.ClaimStrings{"campuscompass-web"} }, jwt.SigningMethodHS256, testSecret, 401},
		{"wrong signature", func(c *trackingClaims) {}, jwt.SigningMethodHS256, "another-secret-of-at-least-32-characters", 401},
		{"wrong algorithm", func(c *trackingClaims) {}, jwt.SigningMethodHS512, testSecret, 401},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			c := validClaims("demo-a")
			tc.mutate(&c)
			resp, _ := post(t, srv.URL, "demo-a", signed(t, c, tc.method, tc.secret), `{"lat":30.353,"lng":76.365}`)
			if resp.StatusCode != tc.status {
				t.Fatalf("status=%d", resp.StatusCode)
			}
			if len(mr.Keys()) != 0 {
				t.Fatal("rejected token changed Redis")
			}
		})
	}
	for _, token := range []string{"", "not-a-jwt", strings.Repeat("x", 5000)} {
		resp, _ := post(t, srv.URL, "demo-a", token, `{"lat":30.353,"lng":76.365}`)
		if resp.StatusCode != 401 {
			t.Fatalf("malformed auth status=%d", resp.StatusCode)
		}
	}
}

func TestLocationValidationAndServerFreshness(t *testing.T) {
	_, mr, srv := harness(t)
	invalid := []string{
		`{"lat":0,"lng":76.365}`, `{"lat":30.353,"lng":76.4}`, `{"lat":30.353}`, `{"lat":null,"lng":76.365}`, `{"lat":"30.353","lng":76.365}`,
		`{"lat":30.353,"lng":76.365,"heading":360}`, `{"lat":30.353,"lng":76.365,"accuracy":-1}`, `{"lat":30.353,"lng":76.365,"accuracy":5001}`,
		`{"lat":30.353,"lng":76.365,"receivedAt":"2099-01-01T00:00:00Z"}`, `{"lat":30.353,"lng":76.365,"driverEmail":"private@example.test"}`,
		`{"lat":30.353,"lng":76.365} {}`, `{"lat":NaN,"lng":76.365}`, `{"lat":30.353,"lng":76.365,"padding":"` + strings.Repeat("x", 2000) + `"}`,
	}
	for _, body := range invalid {
		resp, raw := post(t, srv.URL, "demo-a", grant(t, "demo-a"), body)
		if resp.StatusCode != 400 {
			t.Fatalf("status=%d for %s: %s", resp.StatusCode, body, raw)
		}
	}
	if len(mr.Keys()) != 0 {
		t.Fatal("invalid position changed Redis")
	}
	resp, raw := post(t, srv.URL, "demo-a", grant(t, "demo-a"), `{"lat":30.3491,"lng":76.3572,"heading":0,"accuracy":0}`)
	if resp.StatusCode != 200 {
		t.Fatalf("boundary coordinates status=%d: %s", resp.StatusCode, raw)
	}
	if bytes.Contains(raw, []byte("fake-driver")) || bytes.Contains(raw, []byte("tracking")) {
		t.Fatalf("private data leaked: %s", raw)
	}
}

func TestWebSocketSnapshotUpdateAndRejectedPublisherSilence(t *testing.T) {
	_, _, srv := harness(t)
	conn := connect(t, srv.URL)
	initial := readEvent(t, conn)
	if initial["type"] != "vehicle.snapshot" || len(initial["vehicles"].([]any)) != 0 || initial["ttlSeconds"] != float64(120) {
		t.Fatalf("snapshot=%v", initial)
	}
	resp, _ := post(t, srv.URL, "demo-a", grant(t, "demo-b"), `{"lat":30.354,"lng":76.366}`)
	if resp.StatusCode != 403 {
		t.Fatal(resp.StatusCode)
	}
	resp, _ = post(t, srv.URL, "demo-a", grant(t, "demo-a"), `{"lat":30.353,"lng":76.365}`)
	if resp.StatusCode != 200 {
		t.Fatal(resp.StatusCode)
	}
	event := readEvent(t, conn)
	if event["type"] != "vehicle.location" || event["vehicleId"] != "demo-a" || event["lat"] != 30.353 {
		t.Fatalf("event=%v", event)
	}
	for key := range event {
		if key != "type" && key != "vehicleId" && key != "lat" && key != "lng" && key != "receivedAt" && key != "heading" && key != "accuracy" {
			t.Fatalf("private event field=%s", key)
		}
	}
}

func TestConcurrentVehiclesAndAtomicLastEvent(t *testing.T) {
	s, _, srv := harness(t)
	conn := connect(t, srv.URL)
	readEvent(t, conn)
	const vehicles = 8
	var workers sync.WaitGroup
	errors := make(chan string, vehicles)
	for i := 0; i < vehicles; i++ {
		id := fmt.Sprintf("demo-%d", i)
		token := grant(t, id)
		workers.Add(1)
		go func() {
			defer workers.Done()
			req, _ := http.NewRequest(http.MethodPost, srv.URL+"/api/v1/vehicles/"+id+"/location", strings.NewReader(`{"lat":30.353,"lng":76.365}`))
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("Authorization", "Bearer "+token)
			resp, err := http.DefaultClient.Do(req)
			if err != nil {
				errors <- err.Error()
				return
			}
			defer resp.Body.Close()
			if resp.StatusCode != 200 {
				errors <- fmt.Sprint(resp.StatusCode)
			}
		}()
	}
	workers.Wait()
	close(errors)
	for err := range errors {
		t.Fatal(err)
	}
	seen := make(map[string]bool)
	for i := 0; i < vehicles; i++ {
		event := readEvent(t, conn)
		seen[event["vehicleId"].(string)] = true
	}
	view, err := s.snapshot(context.Background())
	if err != nil || len(view.Vehicles) != vehicles || len(seen) != vehicles {
		t.Fatalf("isolated vehicles snapshot=%+v seen=%v err=%v", view, seen, err)
	}
	for i := 0; i < 6; i++ {
		lat := 30.353 + float64(i)*0.0001
		resp, _ := post(t, srv.URL, "demo-0", grant(t, "demo-0"), fmt.Sprintf(`{"lat":%f,"lng":76.365}`, lat))
		if resp.StatusCode != 200 {
			t.Fatal(resp.StatusCode)
		}
		event := readEvent(t, conn)
		last, err := s.latest(context.Background(), "demo-0")
		if err != nil || event["lat"] != last.Lat {
			t.Fatalf("atomic latest/event mismatch: %v %+v %v", event, last, err)
		}
	}
}

func TestOriginAllowlistAndDependencyFailure(t *testing.T) {
	_, mr, srv := harness(t)
	for _, origin := range []string{"http://evil.example", "http://localhost:5173.evil.example", "null"} {
		req, _ := http.NewRequest(http.MethodGet, srv.URL+"/api/v1/vehicles", nil)
		req.Header.Set("Origin", origin)
		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		_ = resp.Body.Close()
		if resp.StatusCode != 403 {
			t.Fatalf("origin %s status=%d", origin, resp.StatusCode)
		}
	}
	for _, origin := range []string{"", "http://evil.example"} {
		header := http.Header{}
		if origin != "" {
			header.Set("Origin", origin)
		}
		conn, resp, err := websocket.DefaultDialer.Dial("ws"+strings.TrimPrefix(srv.URL, "http")+"/ws/vehicles", header)
		if conn != nil {
			_ = conn.Close()
		}
		if err == nil || resp.StatusCode != 403 {
			t.Fatalf("WS origin %s response=%v err=%v", origin, resp, err)
		}
	}
	req, _ := http.NewRequest(http.MethodOptions, srv.URL+"/api/v1/vehicles/demo-a/location", nil)
	req.Header.Set("Origin", testOrigin)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	_ = resp.Body.Close()
	if resp.StatusCode != 204 || resp.Header.Get("Access-Control-Allow-Origin") != testOrigin {
		t.Fatal("allowlisted preflight failed")
	}
	brokerAddr := mr.Addr()
	mr.Close()
	resp, err = http.Get(srv.URL + "/health")
	if err != nil {
		t.Fatal(err)
	}
	raw, _ := io.ReadAll(resp.Body)
	_ = resp.Body.Close()
	if resp.StatusCode != 503 {
		t.Fatalf("dependency health status=%d", resp.StatusCode)
	}
	if bytes.Contains(raw, []byte("tcp")) || bytes.Contains(raw, []byte(brokerAddr)) {
		t.Fatalf("raw Redis failure exposed: %s", raw)
	}
	resp, err = http.Get(srv.URL + "/live")
	if err != nil {
		t.Fatal(err)
	}
	_ = resp.Body.Close()
	if resp.StatusCode != 200 {
		t.Fatal(resp.StatusCode)
	}
}

func TestBoundedViewersAndSlowReader(t *testing.T) {
	h := newHub()
	defer h.close()
	c := h.register()
	if c == nil {
		t.Fatal("register failed")
	}
	for i := 0; i <= viewerQueueSize; i++ {
		h.broadcast([]byte("event"))
	}
	select {
	case <-c.done:
	default:
		t.Fatal("slow reader was not disconnected")
	}
	for i := 0; i < maxViewers; i++ {
		if h.register() == nil {
			t.Fatal("capacity too small")
		}
	}
	if h.register() != nil {
		t.Fatal("unbounded viewer count")
	}
}

func TestConcurrentSameVehicleLastStoredMatchesLastPublished(t *testing.T) {
	s, _, srv := harness(t)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	subscriber := s.redis.Subscribe(ctx, s.channel())
	defer subscriber.Close()
	if _, err := subscriber.Receive(ctx); err != nil {
		t.Fatal(err)
	}
	channel := subscriber.Channel()
	const updates = 20
	token := grant(t, "demo-a")
	var workers sync.WaitGroup
	problems := make(chan string, updates)
	for i := 0; i < updates; i++ {
		lat := 30.353 + float64(i)*0.00001
		workers.Add(1)
		go func() {
			defer workers.Done()
			req, _ := http.NewRequest(http.MethodPost, srv.URL+"/api/v1/vehicles/demo-a/location", strings.NewReader(fmt.Sprintf(`{"lat":%.5f,"lng":76.365}`, lat)))
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("Authorization", "Bearer "+token)
			response, err := http.DefaultClient.Do(req)
			if err != nil {
				problems <- err.Error()
				return
			}
			defer response.Body.Close()
			if response.StatusCode != http.StatusOK {
				problems <- fmt.Sprint(response.StatusCode)
			}
		}()
	}
	workers.Wait()
	close(problems)
	for problem := range problems {
		t.Fatal(problem)
	}
	var last locationEvent
	for i := 0; i < updates; i++ {
		select {
		case message := <-channel:
			if err := json.Unmarshal([]byte(message.Payload), &last); err != nil || !validPosition(last.Position) {
				t.Fatalf("malformed rapid event: %s", message.Payload)
			}
		case <-ctx.Done():
			t.Fatal("concurrent updates lost a publication")
		}
	}
	stored, err := s.latest(context.Background(), "demo-a")
	if err != nil || stored.Lat != last.Lat || !stored.ReceivedAt.Equal(last.ReceivedAt) {
		t.Fatalf("last publication differs from latest key: %+v %+v %v", stored, last, err)
	}
}

func TestWebSocketBootstrapDeliversLaterCommitWithEarlierReceivedAt(t *testing.T) {
	s, _, srv := harness(t)
	initial := Position{VehicleID: "demo-a", Lat: 30.353, Lng: 76.365, ReceivedAt: time.Now().UTC()}
	if err := s.save(context.Background(), initial); err != nil {
		t.Fatal(err)
	}
	conn := connect(t, srv.URL)
	snapshot := readEvent(t, conn)
	if snapshot["type"] != "vehicle.snapshot" || len(snapshot["vehicles"].([]any)) != 1 {
		t.Fatalf("snapshot=%v", snapshot)
	}
	// An earlier request may generate its server timestamp, wait for Redis,
	// and commit after a later request. Simulate that legitimate scheduling
	// order at the store boundary; the public API still rejects client time.
	delayed := Position{VehicleID: "demo-a", Lat: 30.354, Lng: 76.366, ReceivedAt: initial.ReceivedAt.Add(-time.Millisecond)}
	if err := s.save(context.Background(), delayed); err != nil {
		t.Fatal(err)
	}
	stored, err := s.latest(context.Background(), delayed.VehicleID)
	if err != nil || stored.Lat != delayed.Lat {
		t.Fatalf("latest=%+v err=%v", stored, err)
	}
	event := readEvent(t, conn)
	if event["type"] != "vehicle.location" || event["lat"] != delayed.Lat || event["receivedAt"] != delayed.ReceivedAt.Format(time.RFC3339Nano) {
		t.Fatalf("later committed update was lost: %v", event)
	}
}
