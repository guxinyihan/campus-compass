# Validation and unfinished release ledger

Last updated: **2026-10-04, Asia/Shanghai**. This document records implementation
evidence and outstanding acceptance gates. It is not a final report or a claim
that CampusCompass is ready for publication. No public repository publication,
hosted CI success, complete container startup, or container GraphHopper acceptance
is asserted here. `FINAL_REPORT.md` remains pending until mandatory release gates
are satisfied.

The retained source foundation is MapMitra
`1d5420787b2f5a7a42b2a9ce17792ed7f97149fc`. Baseline failures and implementation
tests are distinct: [BASELINE.md](BASELINE.md),
[UPSTREAM_DELTA.md](UPSTREAM_DELTA.md), and
[ARCHITECTURE_REALITY_AUDIT.md](ARCHITECTURE_REALITY_AUDIT.md) describe the inherited
source; this ledger describes the current implementation.

## Environment and evidence limits

| Tool/dependency | Locally observed version | Scope |
| --- | --- | --- |
| Node.js / npm | 24.18.0 / 11.16.0 | Native frontend, identity and acceptance tooling |
| Python | 3.14.7 | Local isolated routing venv; Docker/CI target Python 3.12 |
| Go | 1.26.5 | Native Go tests, vet and race checks |
| Java / GraphHopper | Java 21 / GraphHopper 10.2 | Actual native engine with repository OSM input |
| MongoDB | 8.0.18 | Actual disposable `mongod`; not a mocked database |
| Redis | Windows 3.2.100 | Actual disposable native test server, persistence disabled |
| Compose client | 2.39.4 | Configuration validation only; no usable Docker engine |
| Production Redis target | 7.4.7-alpine | Configured in Compose/CI; execution still unverified |

The local environment has no usable Docker daemon or configured WSL runtime.
A standalone Compose client can resolve YAML and environment variables without
building images or starting containers. Its successful configuration check does
not establish container compatibility, readiness or networking.

The old Windows Redis binary exists only as local test tooling outside the active
project; it is not a production dependency. Native Redis evidence is useful but
does not replace testing the configured Redis 7.4.7 container. Local Python 3.14
results do not represent executing the Python 3.12 image. A separate pip dry-run
successfully resolved all pinned runtime/development dependencies for CPython 3.12
on Linux, including compatible manylinux 2.28/2.17/2014 wheels; that is dependency
availability evidence, not execution in Linux or a container.

Only fake `@example.test` accounts and explicitly simulated vehicle metadata are
used for acceptance. The system has not integrated a real campus fleet or a
production identity dataset.

## Implemented checks and measured results

| Area | Result | Evidence and practical boundary |
| --- | --- | --- |
| Frontend unit/component tests | **PASS: 28 tests in 8 files** | Vitest/React Testing Library; search, route failure/progress, GPS denial and cleanup, vehicle freshness/stream state, identity/admin/driver behavior |
| Frontend ESLint and production build | **PASS** | Repository frontend scripts; does not replace real-browser workflows |
| Node identity/admin tests | **PASS: 14 tests** | `node:test`/Supertest backed by actual MongoDB 8.0.18, including hash/login, default student role, injection/escalation rejection, admin CRUD, assignment invariants, grants and readiness |
| Node ESLint | **PASS** | Source and test lint scripts |
| Python routing tests | **PASS: 75 tests** | Pytest; request/order/bounds, canonical data, ranking/aliases, landmark distance/fallback, engine errors, concurrent async calls and bounded stalled requests |
| Python Ruff check/format | **PASS** | Current `api` and `tests` source |
| Python dependency consistency | **PASS** | `pip check` reports no broken requirements; all runtime/transitive and development versions pinned |
| Python 3.12 Linux wheel resolution | **PASS: dry-run only** | All pins resolve as binary/universal distributions; no Linux test execution claimed |
| Canonical campus validation | **PASS** | 395 features, 106 named POIs, 4,100 OSM nodes, 455 ways, 10 relations; six duplicate normalized name groups reported and retained separately |
| Go domain/integration tests | **PASS: 11 top-level tests, 13 authorization subcases** | Includes actual Redis Lua/latest/TTL and WebSocket integration, rejection without writes, concurrency, stream bootstrap order, bounded/slow readers, origins and dependency failures |
| Go race and vet | **PASS** | Actual Redis included in race run; local Windows linker workaround described below |
| Configuration initializer | **PASS** | Fresh isolated template generated four distinct private values; an existing file remained unchanged; native engine config uses canonical paths and loopback binding |
| Native GraphHopper acceptance | **PASS: actual engine** | Java 21/GraphHopper 10.2, canonical OSM import and routing API; route 411.799 m, estimated walking duration 296.496 s, 6 instructions, non-empty geometry |
| Compose configuration | **PASS** | Standalone Compose 2.39.4 `config --quiet`; full image build/start remains unverified |
| Active source boundary check | **PASS** | No divergent original map copies, public Nominatim autocomplete, inherited service hosts or active retired ride experiment |
| Git whitespace check | **PASS at this snapshot** | `git diff --check`; rerun after final edits |
| Tracked-source secret/license scan | **PASS** | Rewritten README removed the inherited credential-bearing Mongo URI example. Scanner checks current tracked source and original license; it is not an exhaustive credential audit |

The Python test run emits one Starlette TestClient deprecation warning for using
HTTPX rather than HTTPX2. All 75 tests pass; the warning is test tooling behavior,
not proof of a runtime failure. No hosted test run has been observed yet.

The native GraphHopper jar SHA-256 is
`ead763749c395ea0cc45b3fd10092d6de84d62fb5cbaf7d416ba6cc142c5716c`.
The Dockerfile independently verifies that hash when downloading the official
10.2 artifact. The profile is ordinary walking using `foot.json`, without a
wheelchair/accessibility suitability claim or measured ETA accuracy percentage.
See [routing algorithms](ROUTING_AND_POI_ALGORITHMS.md) and
[accessibility audit](ACCESSIBILITY_ROUTING_AUDIT.md).

The canonical data hashes describe preserved audited Windows checkout bytes;
`.gitattributes` disables newline conversion for those files. Original LF Git
blob hashes are separately documented in
[DATA_LICENSE_AND_PROVENANCE.md](DATA_LICENSE_AND_PROVENANCE.md). The original MIT
license text/copyright is checked against upstream with newline normalization;
data remains ODbL and GraphHopper remains Apache 2.0.

## Reproduce the implemented checks

Run each component block from its named directory after installing the stated
runtime. npm uses committed lockfiles. Python uses an isolated venv with
`requirements-dev.txt`. No test requires contacting an inherited cloud endpoint.

Frontend (`frontend/`):

```sh
npm ci
npm run lint
npm test
npm run build
```

Node API (`backend/`):

```sh
npm ci
npm run lint
npm test
```

Node tests launch a disposable MongoDB 8.0.18 through `mongodb-memory-server`
unless `MONGO_TEST_URI` supplies an actual test server. Despite that package name,
the local validation executed a real MongoDB binary. The tests use an isolated
database name and clean it up; use a disposable database server for acceptance.

Routing (`routing-backend/`, after venv activation):

```sh
python -m pip install -r requirements-dev.txt
python -m pip check
python -m ruff check api tests
python -m ruff format --check api tests
python -m pytest -q
python ../scripts/validate-campus-data.py
```

Local routing tests used the ignored `work/routing` venv. A cross-platform
availability probe for the Docker/CI Python version used:

```sh
python -m pip install --dry-run --ignore-installed --only-binary=:all: --platform manylinux_2_28_x86_64 --platform manylinux_2_17_x86_64 --platform manylinux2014_x86_64 --python-version 3.12 --implementation cp --abi cp312 -r requirements-dev.txt
```

Go (`tracking/`), with an actual disposable Redis server available:

```sh
go test ./... -count=1
TRACKING_TEST_REDIS_ADDR=127.0.0.1:6379 go test ./... -count=1 -v
TRACKING_TEST_REDIS_ADDR=127.0.0.1:6379 go test -race ./... -count=1 -v
go vet ./...
```

The environment variable is exactly **`TRACKING_TEST_REDIS_ADDR`**. If it is
absent, the real Redis integration test explicitly skips; miniredis results alone
must not be recorded as actual Redis acceptance.

On this Windows host, Go defaults reported `CGO_ENABLED=1`, `CC=gcc`, resolving to
MinGW GCC 8.1.0. The initial race executable failed to load synchronization
symbols. The successful PowerShell run used the same actual Redis with:

```powershell
$env:TRACKING_TEST_REDIS_ADDR = '127.0.0.1:6379'
$env:CGO_LDFLAGS = '-lsynchronization'
go test -race ./... -count=1 -v
go vet ./...
```

`CC` and `CGO_ENABLED` were not overridden. Local Go cache/path variables pointed
at ignored workspace tooling directories; Linux CI does not require this Windows
linker workaround. Actual Redis test logs include `redis_version:3.2.100`.
The root verification rerun initially selected an empty module cache and could
not download dependencies from the network. Reusing the established local
module/cache paths with `GOPROXY=off` resolved the tooling issue; current-source
race tests, vet and build passed again with actual Redis and no skipped tests.

Repository checks (repository root):

```sh
python scripts/validate-campus-data.py
python scripts/check-boundaries.py
python scripts/check-release-source.py
git diff --check
python scripts/init-env.py
docker compose config --quiet
```

The environment initializer generates private ignored `.env` values; do not
paste them into reports or commit them. The successful local Compose check used
the equivalent standalone client at `../../work/tools/docker-compose.exe`.
The actual build attempt failed because the Docker API named pipe
`dockerDesktopLinuxEngine` does not exist. It was retried outside the sandbox
after a plugin access restriction, confirming the missing engine rather than
infering it from configuration parsing. No image build or container startup
succeeded; no global Docker/WSL installation was performed.

## Actual native acceptance evidence

### Full-stack services — PASS

`node --env-file=.env scripts/acceptance.mjs` passed again after GraphHopper
recovery. All three API readiness endpoints returned 200. Actual local POI search
selected a campus hostel and library; the real engine returned 411.799 meters,
296.496 estimated seconds and six instructions with non-empty geometry.

With synthetic accounts, the script verified student admin rejection,
administrator driver promotion and vehicle assignment, Node tracking grant,
authorized Go write, Redis latest snapshot and an actual WebSocket location
event. Cross-vehicle publishing and an access token at tracking were rejected;
the existing latest snapshot remained unchanged. A scheduled notice was created.

### Actual browser — PASS: four workflows, zero skips

Chrome **154.0.8037.93**, Playwright's installed locked version, and the actual
local services were used. The final suite passed all four tests in **45.9 s**,
with zero skips/failures. Anonymous search/route and desktop (1440×1000), tablet
(834×1112), mobile (390×844) captures passed without horizontal overflow. No
Nominatim/httpbin/obsolete service host request was seen. GPS denial was supplied
through a browser fixture; manual controls remained enabled. Admin login,
metadata/notice rendering and logout passed. Its strengthened workflow also
registered a unique fake student, promoted it through the admin UI, created an
assigned simulated vehicle, edited that vehicle, created/edited a scheduled
notice and verified the notice in an anonymous viewer. It deleted only that
test's own vehicle/notice, verified public absence, demoted its own account
back to student and logged out. The driver workflow used browser
geolocation emulation (not a physical GPS device), real authentication and real
publishing: changing the supplied location moved the public marker over actual
WebSocket delivery; stopping released its watch and the row became stale.

The first driver browser run exposed a five-second first-fix delay. An RTL
regression failed before its fix; publishing now begins on the first adequate
fix, with subsequent attempts bounded to at least five seconds. The actual
driver browser case then passed in 37.6 seconds. Route failure regressions were
also expanded, bringing frontend tests to 28. The final four-workflow suite
passed after these source changes, including admin CRUD and the driver stale
check. Fake student accounts remain because v1 has no account deletion API.

Actual desktop, simulated live shuttle and admin captures were visually
inspected. OpenStreetMap attribution is visible. Public OSM raster tiles were
unavailable during capture; campus vectors and the route rendered on a plain
basemap. These files contain only fake identities and no tokens/configuration.
UI keyboard coverage remains in component tests rather than a comprehensive
browser accessibility certification.

### Real GraphHopper outage and recovery — PASS

The owned native GraphHopper process was stopped. Routing readiness returned
503; the route call returned 504 with safe `ROUTING_TIMEOUT` on this Windows
connection timeout. The failure scenario permits either documented connection
unavailability (503) or timeout (504), with its corresponding safe error code:

```sh
# With the actual engine stopped, from e2e:
node scenarios/routing-outage.mjs
```

The actual browser displayed “Routing is temporarily unavailable. Please try
again.” and usable route controls. The route was absent rather than a fabricated
fallback. After restarting the same actual engine/cache, all services were
healthy and the real 411.799-meter route and full-stack script passed again.

### Actual simulator, stale/offline and expiry — PASS

From `e2e/`, with private fake driver credentials loaded:

```sh
node --env-file=../.env scenarios/simulator.mjs
```

The scenario launched the actual optional simulator for three HTTP samples on
the assigned, explicitly simulated vehicle. The real WebSocket received all
three events, the browser marker moved without refresh and the public latest
endpoint matched the final sample. Events contained only type, vehicleId,
lat/lng, receivedAt and accuracy; no account/token data.

After the finite simulator stopped, the real clock produced a stale browser row
after 30 seconds and an offline row after 120 seconds. The latest endpoint
returned 404 and all expired location markers were removed; metadata remained
visible as offline. This exercised actual Redis expiry and UI behavior, without
advancing a fake timer. Native Redis tests also verify the configured TTL and
isolation of rejected writes. Frontend unit tests cover watcher cleanup and
deliberate routing; visitor GPS is not part of the publishing path.

### Container acceptance — UNVERIFIED / mandatory release gate

On a Docker-capable host, from the repository root:

```sh
python scripts/init-env.py
docker compose config --quiet
docker compose build
docker compose up -d --wait
docker compose ps
docker compose exec api npm run seed:admin
node --env-file=.env scripts/seed-demo.mjs
node --env-file=.env scripts/acceptance.mjs
```

Verify all seven services healthy, canonical OSM import and a positive actual
**container** GraphHopper route through the routing API. Repeat browser/simulator
acceptance against that stack and actual Redis 7.4.7. Do not relabel the successful
native GraphHopper run as this container test. Preserve generated graph/Mongo
volumes intentionally; ordinary shutdown need not delete stored demo metadata.

## Release checklist from requested phase 96

| Required gate | Current status / remaining evidence |
| --- | --- |
| Architecture reality audit complete | **PASS: audit documents present**, source evidence retained |
| Upstream delta documented | **PASS: UPSTREAM_DELTA.md**, observed commits compared |
| Original MIT license preserved | **PASS: canonical upstream text/copyright comparison** |
| Data licensing documented | **PASS: ODbL provenance and canonical hashes documented** |
| OpenStreetMap attribution visible | **PASS: visually reviewed actual map screenshots** |
| No public Nominatim autocomplete | **PASS: source check and actual browser request review** |
| Frontend tests pass | **PASS: 28 tests / 8 files** |
| Frontend production build passes | **PASS** |
| Node auth/admin tests pass | **PASS: 14 tests, actual MongoDB** |
| Role escalation tests pass | **PASS: Node tests and actual service student-admin rejection** |
| Routing tests pass | **PASS: 75 tests and Ruff** |
| Real local GraphHopper route verified | **PASS: native**; **required container run unverified** |
| Geolocation cleanup tests pass | **PASS: frontend tests and actual driver stop/watch status** |
| Go tracking tests pass | **PASS: 11 top-level tests / 13 authorization subcases** |
| Redis integration passes | **PASS: actual Windows 3.2.100**; target **7.4.7 pending** |
| Driver authorization tests pass | **PASS: tests and actual authorized driver service/browser flow** |
| Cross-vehicle spoof test passes | **PASS: Go tests and actual full-stack rejected cross-vehicle write** |
| WebSocket live-update test passes | **PASS: actual Redis/WS, driver and simulator browser marker movement** |
| Docker Compose config passes | **PASS: Compose 2.39.4**, parsing only |
| Complete local stack starts when tooling available | **PASS: complete native services**; **container build/start/health unverified** |
| Obsolete hard-coded cloud URLs removed | **PASS: active source and final frontend production bundle scan** |
| Fake shuttle positions removed | **PASS: inherited operational mocks removed; labeled authorized simulator exercised** |
| README claims only real features | **PASS: rewritten around implemented native evidence and explicit limitations** |
| Real screenshots exist | **PASS: actual desktop/tablet/mobile/admin/live/outage/offline captures** |
| Secret scan passes | **PASS: current tracked-source scan; staged/final checks are rerun at commit** |

Remaining conditions: execute production Redis 7.4.7 and complete
container acceptance on a Docker-capable host. Publication is deferred until
those mandatory environment gates pass. Hosted CI must be inspected after
publication; workflow YAML is not a successful hosted run.
`.github/workflows/ci.yml` supplies checks but is not evidence they have run.
Do not publish or create `FINAL_REPORT.md` until required checks pass and this
ledger is updated with their observed outcomes.

## Delivery and Git state

Implementation and documentation live in this isolated CampusCompass
repository. Upstream remains named `upstream`; no new `origin` or public
repository has been created. The observed foundation HEAD and the earlier
`5e80c1821088963b9f28d938f6000a2f3d7f58da` are ancestors of this implementation.
Original code license text/copyright and canonical data bytes are preserved.
Changes were committed incrementally after audits, failing regressions and
component/service verification. No reset, synthetic initial history or force
push was used.

Private `.env`, dependencies, platform tools, runtime logs, actual database
files and generated graphs remain untracked. Retired misleading upstream
documentation is inspectable through Git history and replaced in the active
tree by scoped source-backed documentation.

Once a Docker-capable environment is available, run container acceptance,
address any real failures, recheck release hygiene, create the requested
new unused public repository, preserve `upstream` and add `origin`, push, inspect
actual hosted CI, and only then create `FINAL_REPORT.md`. Native passes do not
establish these unfinished environment/release gates.
