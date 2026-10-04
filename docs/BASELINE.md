# Safe upstream baseline

Recorded 2026-10-04 before replacement source changes. Foundation
`1d5420787b2f5a7a42b2a9ce17792ed7f97149fc`.

| Tool | Observed version |
|---|---|
| Node | v24.18.0 |
| npm | 11.16.0 |
| Python | 3.14.7 |
| Go | go1.26.5 windows/amd64 |
| System Java | Java 8 (unsuitable for planned GraphHopper 10.2) |
| Docker daemon | Not installed/available; no configured WSL distribution |

Separate frontend/Node installation directories and npm cache, Python virtual
environment and Go caches were used under ignored scratch directories. No
external upstream production service was called to declare success.

## Frontend

`npm ci` exited 1 with EUSAGE: lock file missing `open-location-code@1.0.3`.
Therefore the unmodified frontend is not reproducibly installable with npm ci.
A separate diagnostic install is used only to inspect build/test behavior and
does not repair the baseline lock silently. Source inspection confirms public
autocomplete, fixed fake vehicles, multiple GPS watches and GPS-triggered
routing. Connected navigation/tracking/admin workflows were not established.

## Identity backend

Isolated `npm ci` exited 0 (200 packages). `npm start` exited 1 with
`ERR_MODULE_NOT_FOUND` for `auth.middleware.js` imported from user.routes.js.
This happens before Mongo connection/listen. The source also has named/default
export mismatches, case differences, missing jwt and identity claim mismatch.
No baseline auth test suite exists. Successful installation is not auth success.

## Python routing

An isolated Python environment and HTTP stub compatibility probe reproduced
the actual inherited endpoint without requiring GraphHopper/production hosts.
Loading from repository root fails on relative GeoJSON path. Empty coordinate
lists return 500; 0,0 is accepted and reaches the engine; no-path and unsupported
first instruction return 500; network exception details reach clients. `/health`
returns 404. The probe is an inherited-source failure characterization, not
real GraphHopper integration. See routing/data audit for exact source evidence.

## Go / Quinjet

`go test ./...` initially exited 1 because proxy.golang.org dependency ZIP
connections timed out; health package compiled with no tests. A retry through
goproxy.cn retained Go checksum verification. Source has HTTP ride queues,
no WebSocket/location authorization, no request TTL and disabled cleanup worker.
There are no upstream `_test.go` files. Dependency compilation alone does not
establish a connected ride/tracking workflow.

## Infrastructure and publication

Root Compose defines four partial services, not the whole product. No Docker
build/start or engine-backed acceptance was possible at baseline. A portable
Compose client may validate configuration later; it does not supply a daemon.
GitHub CLI initially failed inside sandbox credential access. Authorized
read-only credential verification outside that restriction confirmed the
active account `guxinyihan`; publication remains conditional on release gates.

## First regression evidence

`python scripts/check-boundaries.py --revision 1d542078...` exited 1 with seven
source violations: Firebase callback, inherited hosts/autocomplete, shared user1
identity and divergent map data. This check remains reproducible against the
immutable foundation. Geolocation/routing/auth/tracking runtime regressions are
added in their own suites; a source scan does not substitute for these tests.
