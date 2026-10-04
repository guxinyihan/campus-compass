# Tracking service

Go owns temporary vehicle locations. Node/Mongo owns accounts, roles, vehicle
metadata and driver assignments; Node issues the driver grant. The retired
Quinjet ride experiment remains in upstream Git history, outside active setup.

The service verifies HS256 tracking JWTs with issuer `campuscompass-api`, audience
`campuscompass-tracking`, nonempty subject, `role:driver`, `tokenType:tracking`,
matching `vehicleId`, issued-at and expiry. Grants last at most 120 seconds.
Assignment changes stop new grants in Node; existing grants can remain valid
until their expiry. Authentication uses a distinct secret from browser access
tokens. Tokens belong in the Authorization header, never in WebSocket URLs.

`POST /api/v1/vehicles/{vehicleId}/location` accepts `lat`, `lng`, optional heading
in [0,360), and optional accuracy in [0,5000] meters. Latitude must be within
30.3491..30.3598 and longitude within 76.3572..76.37529. Unknown fields, missing
coordinates and client timestamps are rejected. Server time controls freshness.
Successful writes atomically replace `vehicle:{vehicleId}:latest`, reset its
120-second TTL and publish the public location event using a Redis Lua script.
There is no GPS history, queue, stream or persistent account information here.
Redis persistence is disabled in the application Compose configuration.

`GET /api/v1/vehicles` returns `{vehicles,staleAfterSeconds:30,ttlSeconds:120}`;
`GET /api/v1/vehicles/{vehicleId}` returns one position or 404 after expiry.
`WS /ws/vehicles` is an actual WebSocket. Its initial `vehicle.snapshot` event
contains the snapshot fields; later `vehicle.location` events contain only type,
vehicleId, coordinates, receivedAt and optional heading/accuracy. Only explicit
allowed browser origins connect; native test clients send an allowed Origin.

Each process allows 128 viewers with 32 buffered messages per viewer. Slow
viewers disconnect, and the UI reconnects with a fresh snapshot. Redis pub/sub
is transient; it has no replay or delivery guarantee during broker outages.
The UI marks positions stale after 30 seconds and offline after 120 seconds.
This portfolio setup does not claim production-scale delivery or real campus
fleet integration. `/health` checks Redis and stream availability; `/live`
reports process liveness. Errors expose no raw Redis internals.

Run tests from this directory:

```sh
go test ./...
TRACKING_TEST_REDIS_ADDR=127.0.0.1:6379 go test ./... -count=1
TRACKING_TEST_REDIS_ADDR=127.0.0.1:6379 go test -race ./... -count=1
go vet ./...
```

Without `TRACKING_TEST_REDIS_ADDR`, the actual Redis test explicitly skips;
miniredis tests still run. Real-server integration uses a unique key prefix and
never flushes unrelated keys. CI targets Redis 7.4. Local Windows verification
also exercised a disposable Redis 3.2.100 instance with persistence disabled;
that old binary is test tooling outside this repository, not production setup.
On the tested Windows host, MinGW GCC 8.1 linked race runtime synchronization
symbols to the wrong DLL. Setting `CGO_LDFLAGS=-lsynchronization` for the local
race command resolved that loader error; ordinary tests require no workaround.

The optional `scripts/simulate-shuttle.mjs` reads credentials from environment,
requires an active vehicle labeled `simulated:true`, logs in as an assigned fake
driver, obtains the same short-lived grant, and publishes through the same HTTP
API. It never writes Redis directly. Set `DEMO_EMAIL`, `DEMO_PASSWORD` and
`DEMO_VEHICLE_ID`, optionally `API_URL`, `TRACKING_URL`, `DEMO_INTERVAL_MS` or
`DEMO_SAMPLES`, then run `node scripts/simulate-shuttle.mjs` from the repository
root. A session expires after 15 minutes; relaunch with valid credentials.
