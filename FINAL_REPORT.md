# CampusCompass final engineering report

Recorded **2026-10-04, Asia/Shanghai**, after local container acceptance,
publication and the first successful hosted run. Release evidence applies to
**f91b690cbd22b166622e0c75e5741d61a1771c14**; images used
**16db02c9689651c869fc67fa9f311bd78df56a80**. Final documentation receives a
separate hosted check. Detailed evidence: [VALIDATION.md](docs/VALIDATION.md).

## 1. Upstream repository

The foundation is [MapMitra by Yash Dogra](https://github.com/yxshee/mapmitra):
React/Leaflet mapping, campus data, GraphHopper/landmark concepts and unfinished
service experiments. CampusCompass acknowledges the inherited application and
map, separating its additions from original work.

## 2. Previous audited commit

The request's previously audited commit was
**1d5420787b2f5a7a42b2a9ce17792ed7f97149fc**. Its separate observed HEAD/newer-commit
candidate was **5e80c182...**. Actual ancestry resolved these labels; timestamps
were not used to infer ordering.

## 3. Current upstream HEAD actually used

Actual remote HEAD/main was **1d5420787b2f5a7a42b2a9ce17792ed7f97149fc**.
**5e80c1821088963b9f28d938f6000a2f3d7f58da** is its parent. Both remain ancestors
of the published implementation.

## 4. Upstream delta

There was zero tree delta between the previously audited commit and actual
upstream HEAD. Earlier **f4f82ea** changed four service READMEs; **5e80c18** added
four large documentation files. Both are documentation changes already included
in the foundation; the final sync commit has an unchanged tree. See
[UPSTREAM_DELTA.md](docs/UPSTREAM_DELTA.md).

## 5. Preserved Git history

Development used a full clone and incremental commits. The original remote
remains `upstream`; the new public repository is `origin`. History and MIT
attribution remain intact, without reset, synthetic history, force push or
overwriting an existing repository.

## 6. Code license

Root [LICENSE](LICENSE) preserves MIT and **Copyright (c) 2024 Yash Dogra**,
verified against the foundation with newline normalization. Backend metadata
now declares MIT; the inherited default ISC inconsistency is documented.

## 7. Data license and provenance

Campus OSM/GeoJSON is OpenStreetMap-derived **ODbL**, separately from MIT code,
with visible contributor attribution. Export recipe, extraction date, current
survey and campus approval remain unestablished. Hashes and redistribution
distinctions are in
[DATA_LICENSE_AND_PROVENANCE.md](docs/DATA_LICENSE_AND_PROVENANCE.md).

## 8. GraphHopper licensing and dependency status

GraphHopper **10.2** is an Apache 2.0 dependency. Its official release jar is
downloaded during image build, with license text retained and SHA-256 verified:
`ead763749c395ea0cc45b3fd10092d6de84d62fb5cbaf7d416ba6cc142c5716c`.
It runs on Java 21; the obsolete inherited third-party image was replaced.
No generated graph or jar is committed as application source.

## 9. Architecture claims audit

[ARCHITECTURE_REALITY_AUDIT.md](docs/ARCHITECTURE_REALITY_AUDIT.md) separates
implemented, partial, broken and documentation-only claims. Baseline/source
evidence exposed installation/contracts, GPS leakage, vehicle mocks and
unsupported WebSocket/admin/ETA claims. Replacement work followed failing
regressions and runtime checks.

## 10. Active final architecture

The browser uses Node identity/admin, FastAPI routing/data and Go tracking.
Node owns Mongo metadata; routing calls GraphHopper over canonical OSM; Go owns
temporary Redis positions/WebSockets. nginx serves React. All seven services have
exercised roles and documented [contracts](docs/API_CONTRACTS.md).

## 11. Removed or deactivated upstream experiments

Retired paths include Quinjet ride matching, unused MySQL/queue helpers,
hardcoded nearby vehicles, mockbackend/httpbin requests, public autocomplete,
incomplete Google/Firebase-style callbacks, unrelated road submissions and
placeholder admin/emergency/recommendation features. Unsupported large upstream
documentation was removed from the active tree. All remain inspectable through
preserved history; see [retired experiments](docs/RETIRED_UPSTREAM_EXPERIMENTS.md).

## 12. Frontend architecture

React separates navigation, driver and admin pages, memory-only authentication,
API adapters, lifecycle hooks and domain algorithms. Leaflet renders canonical
vectors, engine routes and accepted positions. Responsive layouts were exercised
in actual Chrome.

## 13. Canonical campus dataset

Canonical GeoJSON retains **395 features/106 named POIs**; OSM contains
**4,100 nodes/455 ways/10 relations**. Coordinates/properties are preserved.
Startup validates geometry/references; six duplicate-name groups remain distinct.
Scoped Git attributes preserve audited bytes. Divergent active copies were
removed.

## 14. Local POI search algorithm

Search normalizes Unicode, case, punctuation and whitespace; extracts names and
existing aliases; ranks exact, prefix, word-prefix and substring matches; and
breaks ties deterministically by normalized name and stable ID. SHA-derived IDs
and geometry-specific anchors support reproducible results. The browser obtains
the canonical index once for local typing; the API also supports bounded search.
See [algorithms](docs/ROUTING_AND_POI_ALGORITHMS.md).

## 15. Nominatim removal

Public per-keystroke Nominatim autocomplete was removed. Local canonical search
needs no external geocoder. Source/bundle checks and actual browser observations
found no Nominatim, httpbin or obsolete service-host traffic. Raster tiles still
need internet.

## 16. Geolocation lifecycle

An explicit action starts one GPS watch, with permission/error states and manual
fallback. Stop, mode change, navigation end and unmount clear even watch ID zero.
Callbacks are guarded; driver logout, page exit or authorization failure releases
publishing resources.

## 17. Geolocation privacy

Visitor GPS remains browser-local except explicit route/reroute coordinates.
Routing persists no history and disables access logs; authentication/Mongo/Redis/
Go receive no visitor GPS. Tokens stay outside URLs/local storage. External
transport and proxy logging require configuration.

## 18. Off-route and reroute logic

Campus-scale segment projection measures distance to the route. Three adequate
fixes exceeding `max(35 m, accuracy)` produce an off-route prompt; accuracy worse
than 50 m pauses progress/deviation counting. Rerouting requires an explicit
action. Instruction progression approaches the next maneuver start, ordinarily
within 15 m. GPS samples do not initiate route requests.

## 19. Routing API

FastAPI serves campus, POIs and `POST /api/routes`, accepting strict bounded
start/destination coordinates and `walking` only. Output includes LineString,
meters, estimated seconds and instructions. Structured validation/no-route/
engine/timeout errors omit internal engine bodies.

## 20. GraphHopper client

Async HTTPX sends `[longitude,latitude]` points with connect/pool/write/read/
overall limits of **2/2/5/10/12 seconds**; GraphHopper's budget is eight seconds.
Redirects are disabled. Validation checks geometry, measurements and intervals,
converts milliseconds and uses maneuver starts. Mock fixtures remain separate
from actual integration.

## 21. Real GraphHopper acceptance result

Actual container OSM import and routing produced **411.799 m, 296.496 estimated
seconds and six instructions**, with non-empty geometry. Recovery repeated that
route. The browser selected a different hostel/library route, approximately
**891 m and 11 minutes**. These are engine estimates, not measured trip times or
ETA accuracy results. Native engine acceptance was separately recorded.

## 22. Landmark augmentation

Haversine selects the nearest eligible named anchor within **45 m**, with name/ID
ties. Roads, barriers and university-area features are excluded. Cues supplement
original maneuvers; absent matches preserve wording. Anchors are not verified
entrances or routes through buildings.

## 23. Accessibility-routing audit

The inherited data has no wheelchair, kerb or smoothness coverage, inadequate
slope/entrance evidence and no accessibility survey. Missing steps tags do not
establish step-free paths. A pedestrian profile cannot prove wheelchair
suitability. [ACCESSIBILITY_ROUTING_AUDIT.md](docs/ACCESSIBILITY_ROUTING_AUDIT.md)
records the tag counts and unsupported upstream claims.

## 24. Final accessibility claim status

Release scope is ordinary walking; unsupported accessibility profiles are
rejected. Wheelchair suitability and 90% ETA accuracy are not advertised. UI
controls have labels, focus treatment, keyboard-operable forms and textual
states; component checks and responsive browser tests are not a comprehensive
accessibility certification. Audited accessible-route data and evaluation remain
roadmap work.

## 25. Node authentication model

Strict registration creates students with name/email/password only. Passwords
require 12+ characters, <=72 UTF-8 bytes and bcrypt-12. HS256 access JWTs expire
after **15 minutes**, checking issuer/audience/purpose and current Mongo roles.
OAuth, refresh-token and Firebase callback experiments are retired.

## 26. Role model

Visitors navigate anonymously; roles are student, driver and admin. Public input
cannot assign roles/hashes. Admins manage student/driver roles; the private admin
seed refuses silent promotion of ordinary accounts. Backend authorization is
authoritative.

## 27. Vehicle model

Mongo vehicles store name, unique code, active/simulated flags, optional assigned
driver and timestamps. Canonical Mongo IDs identify them. Public metadata omits
assignment/account details; sparse uniqueness enforces one vehicle per driver.
Coordinates stay outside this model.

## 28. Driver assignment

Only active assigned vehicles obtain driver grants. Administrators assign or
release drivers; assigned drivers must be unassigned before demotion. Unique
indexes and per-driver mutation locks prevent the tested assignment/demotion
race in one Node process. Multiple API replicas require transaction-based
coordination, which this local demonstration does not claim.

## 29. Tracking-token architecture

Node issues separate **120-second maximum** HS256 grants using a distinct secret,
issuer `campuscompass-api`, audience `campuscompass-tracking`, driver role,
tracking purpose, subject, vehicle ID and issued/expiry times. Go validates them
before writes. Cross-vehicle grants and access tokens fail. Assignment changes
stop new grants; existing grants may remain usable until their bounded expiry.

## 30. Go tracking service

Go validates authorized bounded positions, timestamps them, exposes snapshots
and streams Redis events. Rejections precede writes/broadcasts. Lua atomically
updates/publishes; safe errors, client bounds and dependency readiness are tested.
Ride booking is outside scope.

## 31. Redis key and TTL model

`vehicle:<vehicleId>:latest` holds only the latest public position, with a
renewed **120-second TTL** on accepted writes. Events use pub/sub; there is no
location history, durable stream or account store. Compose disables Redis
snapshot/AOF persistence. Actual expiry returns 404, while independent test keys
use a unique prefix and are cleaned without flushing application data.

## 32. WebSocket behavior

`/ws/vehicles` sends an initial snapshot, then accepted location events. Explicit
origins are checked; limits are 128 viewers and 32 queued messages each, with
slow viewers disconnected. Reconnects replace state from a fresh snapshot.
Redis event order controls updates even with equal/inverted request timestamps;
timestamps control freshness. Location updates use WebSockets rather than HTTP
polling; outage replay is not guaranteed.

## 33. Location privacy and retention

Public positions contain vehicle ID, coordinates, server time and optional
heading/accuracy, without driver identity, email or token. Vehicle publishing
requires an explicit driver action. Freshness is live below 30 seconds, stale
until 120 seconds, then offline without a marker. Mongo retains account and
administrative metadata but receives no GPS history.

## 34. Demo simulator status

The simulator requires a fake assigned driver and visibly labeled
`simulated:true` vehicle. Ordinary login/grants/HTTP publishing produced three
matching events/latest values and marker movement. It never writes Redis
directly. Deterministic movement demonstrates the pipeline; sessions require
renewed authentication after expiry.

## 35. Admin functionality

UI acceptance exercised driver promotion/demotion, vehicle CRUD, metadata and
assignment through protected Node/Mongo operations. It deletes only owned
vehicle/notice records. Synthetic students remain because v1 lacks account
deletion. Administration is functional and backend-validated.

## 36. Service notices

Notice CRUD stores title/message, severity (`info`, `warning`, `disruption`) and
active windows. Browser acceptance created, edited, viewed anonymously and deleted
a notice. Public viewers see current notices; notices do not modify road weights
or send emergency alerts.

## 37. Docker Compose architecture

Five application images and MongoDB/Redis comprise seven healthy services.
Frontend/API/routing/tracking bind loopback ports **5173/4000/5001/8081**;
Mongo, Redis and GraphHopper stay internal. Canonical data mounts read-only;
Mongo and graph cache use named volumes. A host-specific ignored proxy/build
overlay enabled Linux image builds; runtime used the **unmodified base Compose
file**. Python and Node API ports are distinct.

## 38. Health checks

All seven Compose health checks passed. nginx checks serving; Node checks Mongo;
routing checks the engine's walking profile; GraphHopper checks engine health;
Go checks Redis/stream availability; databases ping. Readiness dependencies
control startup, with separate application liveness endpoints. Stopping the
actual GraphHopper container changed routing readiness to **503**; restoring it
returned all services to healthy.

## 39. Frontend tests

**28 tests in eight files**, ESLint and production build passed locally and in
hosted CI. Coverage includes deterministic search, navigation progress/failure,
GPS denial/watch cleanup, ordered stream/freshness state, identity/admin and
driver publishing. Regression tests reproduced inherited watch leakage and
first-fix publishing delay before fixes. Actual browser acceptance is separate
from these component tests.

## 40. Node tests

**14 tests and lint passed**, locally and hosted, with actual MongoDB **8.0.18**:
hash/login, role/injection rejection, CRUD, assignments, grants and readiness.
Local `mongodb-memory-server` launched a real binary; hosted tests used a Mongo
service. Unique test databases are cleaned.

## 41. Routing tests

**75 tests**, Ruff check/format and dependency consistency passed. Hosted Python
3.12.14 completed pytest in **1.98 s**, with one Starlette TestClient deprecation
warning. Tests cover canonical validation, ranking, coordinate/order checks,
landmarks, malformed engine results, async concurrency and bounded failures.
HTTPX MockTransport fixtures do not establish actual engine import; container
acceptance supplied that separate proof.

## 42. Go tests

Vet and race tests passed with **11 top-level tests and 13 authorization
rejection subcases**. The independent Linux Go 1.26.5 run used actual Redis
7.4.7, with no skips/race reports and **1.750 s** package time; hosted CI reported
**1.710 s**. Windows race verification also passed with its documented local
linker workaround. These timings are test execution, not capacity benchmarks.

## 43. Redis and Mongo integration status

Actual Redis **7.4.7** served the Compose tracker, Linux race suite and hosted
integration; actual Mongo **8.0.18** served authentication/administration and
hosted Node tests. Isolated namespaces/databases prevented unrelated cleanup.
Earlier Windows Redis 3.2.100 evidence is explicitly test tooling, not the
production dependency. Miniredis unit fixtures are not substituted for real
server acceptance.

## 44. Full-stack acceptance

Actual service acceptance verified auth/admin/grants, Redis latest state and
WebSocket delivery; cross-vehicle **403** and wrong-token-type **401** left the
previous location unchanged. Four Chrome workflows passed in **51.8 s**, zero
skips: navigation/responsive layouts, denied-GPS fallback, admin CRUD and driver
publishing/stop. Container outage produced safe documented 503/504 errors and
usable controls; recovery repeated the real route. Real-clock simulation passed
30-second stale and 120-second expiry/404/marker removal.

## 45. Hosted CI

[Run 37210523326](https://github.com/guxinyihan/campus-compass/actions/runs/37210523326)
completed **success**, all five jobs, on release commit **f91b690...**, at
**2026-10-04T14:48:19Z**. Frontend, Node/Mongo, routing, Go/Redis and repository
checks passed. The full-history checkout fixes a locally reproduced shallow
license-check failure; no failed hosted run is invented. Hosted routing mocks
the engine; browser/engine acceptance ran locally. Final documentation commits
trigger another run, checked separately after pushing; its ID is not yet known
in this report snapshot.

## 46. Real screenshots

Seven refreshed Chrome captures use actual container services, synthetic
identities and visible OpenStreetMap attribution. Raster tiles were available
during the final captures. Images are not generated mockups:
[desktop route](docs/screenshots/desktop-route.png),
[tablet](docs/screenshots/tablet-map.png),
[mobile](docs/screenshots/mobile-map.png),
[admin](docs/screenshots/admin.png),
[simulated live shuttle](docs/screenshots/simulated-live-shuttle.png),
[routing outage](docs/screenshots/routing-unavailable.png), and
[offline shuttle](docs/screenshots/shuttle-offline.png).

## 47. Known limitations

Data is inherited without a current survey or verified entrance permissions.
Shuttles are simulated; driver browser GPS was emulated, not a physical device
evaluation. Tiles need internet. Accessibility suitability, ETA accuracy,
automatic arrival shutdown, production TLS/deployment, scale and outage replay
are unverified. Grants can outlive assignment changes briefly; process-local
locks/rate limits require coordination for replicas. WSL uses a hidden local
keep-alive session, not a configured boot service.

## 48. Exact Node, Python and Go versions

| Scope | Node / npm | Python | Go |
| --- | --- | --- | --- |
| Native verification/tooling | 24.18.0 / 11.16.0 | 3.14.7 | 1.26.5 Windows/amd64 |
| Actual application containers | 24.18.0 | 3.12.15 | 1.26.5 builder |
| Hosted CI logs | 24.21.0 / 11.19.0 | 3.12.14 | 1.26.5 Linux/amd64 |

Actual Java was Temurin **21.0.12.1+1**; Chrome was **154.0.8037.93**.
Scopes differ intentionally; native results are not relabeled as container or
hosted execution.

## 49. Exact Docker version verified

Actual Linux/amd64 Docker Engine **29.8.2** and Compose **5.6.0** built the images
and ran all seven services in WSL **3.0.1.0**, running kernel
**6.18.40.1-microsoft-standard-WSL2**, Ubuntu
**24.04.5**, distribution `CampusCompassEngine`. Desktop was upgraded to
**4.93.0.240920**, but its existing Windows socket failure persisted; it was
stopped and autostart disabled. The working engine is independent of Desktop.

## 50. Exact setup commands

On a Docker-capable host, from the repository root:

```sh
python scripts/init-env.py
docker compose config --quiet
docker compose build
docker compose up -d --wait
docker compose ps
docker compose exec api node src/seed.js
node --env-file=.env scripts/seed-demo.mjs
# Store the printed DEMO_VEHICLE_ID in private .env before running the simulator.
```

For this Windows host, use the Linux workspace and dedicated engine:

```powershell
wsl -d CampusCompassEngine -u root --cd /opt/campuscompass --exec docker compose -f docker-compose.yml up -d --wait
```

[Windows setup](docs/WINDOWS_CONTAINER_SETUP.md) records the exact build overlay,
proxy, source export and engine/session commands. Keep secrets private, preserve
volumes with ordinary `docker compose down`, and synchronize later Windows source
changes deliberately to the Linux build snapshot.

## 51. Exact test commands

Run component blocks in their named directories; supply disposable test services:

```sh
# frontend/
npm ci
npm run lint
npm test
npm run build
# backend/
npm ci
npm run lint
npm test
# routing-backend/, isolated venv
python -m pip install -r requirements-dev.txt
python -m pip check
python -m ruff check api tests
python -m ruff format --check api tests
python -m pytest -q
# tracking/, actual Redis
TRACKING_TEST_REDIS_ADDR=127.0.0.1:6379 go test -race ./... -count=1 -v
go vet ./...
# repository root
python scripts/validate-campus-data.py
python scripts/check-boundaries.py
python scripts/check-release-source.py
git diff --check
node --env-file=.env scripts/acceptance.mjs
# e2e/, synthetic seed ready
npm ci
npx playwright install chromium
node --env-file=../.env node_modules/@playwright/test/cli.js test
node --env-file=../.env scenarios/simulator.mjs
```

For the outage test, stop the owned GraphHopper container, run
`node --env-file=../.env scenarios/routing-outage.mjs` from `e2e/`, then restart
GraphHopper and verify recovery. An installed Chrome may be selected with
`CHROME_PATH`. Linux private-network Redis commands and Windows race differences
are detailed in the [validation ledger](docs/VALIDATION.md).

## 52. Git commit summary

At **f91b690**: **64 total commits**, **20 after the foundation**, before final
reporting. Changes cover audits/regressions, secure identity, Redis/WebSockets,
canonical routing, concurrency fixes, frontend, Compose/CI, actual acceptance,
documentation, environment setup and pinned builders. Reporting adds a normal
documentation commit. Current source/license scans passed; the earlier
501-object/60-commit history scan was scoped, not exhaustive. Secrets, tools,
databases, caches and logs remain untracked.

## 53. Public repository URL

[https://github.com/guxinyihan/campus-compass](https://github.com/guxinyihan/campus-compass)
was actually created and pushed, verified **PUBLIC**, default branch **main**,
after local release gates passed. `upstream` remains intact and `origin` points
to this new repository. Publication and the first successful hosted run are
observed results; the final documentation commit receives its own subsequent
CI verification.

## 54. Dependency-security maintenance — 2026-10-05

This maintenance pass starts from reviewed commit
`ee0389464bb332e3e86443d2e3a7cceaa2f1b837` and preserves the verified architecture,
application source, tests, canonical campus data and service contracts. Full
triage, package chains, individual advisories, reachability evidence and minimum
fixed versions are recorded in [DEPENDENCY_SECURITY_AUDIT.md](docs/DEPENDENCY_SECURITY_AUDIT.md).

| Audit measurement | Frontend | Node API |
| --- | --- | --- |
| Previously reviewed CI / fresh successful full baseline | 20: 2 low, 6 moderate, 12 high | 2 high |
| Fresh baseline, production only | 3 high package records | 1 high package record |
| Final full audit | 0 in all severity categories | 0 in all severity categories |
| Final production-only audit | 0 in all severity categories | 0 in all severity categories |

The Node production advisory is `jsonwebtoken -> jws`, not MongoDB test tooling.
The affected `createVerify()` path is absent: the application uses
`jwt.verify()` with fixed secrets, explicitly excluded by the advisory. React
Router advisories are likewise constrained by the existing declarative
`BrowserRouter`, static navigation targets, and absence of framework/SSR
endpoints. They were still upgraded. Vite's network-facing development server
has an applicable Windows file-serving risk; it is absent from the production
Nginx image but warranted a patched tooling version. Counts describe affected
package records rather than independent exploitable production defects.

Frontend locked upgrades: React Router DOM **7.5.2 -> 7.18.4**, Vite
**5.4.11 -> 6.4.3**, Vitest **3.2.7 -> 4.1.11**, React plugin
**4.3.3 -> 4.7.0**, and ESLint / `@eslint/js` **9.14.0 -> 9.39.5**, with
compatible fixes to vulnerable Babel, CSS, build, lint and test transitives.
React/DOM **18.3.1**, Leaflet **1.9.4**, React Leaflet **4.2.1**, and jsdom
**26.1.0** remain unchanged. The API changes only its lockfile: `jws`
**3.2.2 -> 3.2.3**, its required `jwa` **1.4.1 -> 1.4.2**, and lint-only
`brace-expansion` **1.1.11 -> 1.1.21**. No new dependency overrides were added.

The Vite 6 and Vitest 4 migration guides and peer/Node requirements were checked.
These were the smallest fixed major lines needed for the respective advisories;
no application, test, or configuration compatibility repair was necessary.
Both lockfiles were generated through intentional npm commands, followed by
successful clean `npm ci` installs on Node **24.18.0**, npm **11.16.0**.
`npm audit fix --force` was not used.

Fresh local checks passed: frontend lint, **28 tests in eight files**, production
build, complete dependency-tree validation; API lint and **14 tests, zero
skips**, including bcrypt, registration/role injection, admin authorization,
assignment uniqueness, purpose-bound grants and MongoDB index/health behavior;
Python dependency consistency, Ruff lint/format, **75 routing tests**, campus
data validation, source-boundary and current release-source/license scans.
The known Starlette test-client deprecation warning remains. CI now runs
`npm audit --omit=dev --audit-level=high` for both npm projects; both exact
commands pass locally. No test or existing release gate was weakened.

All five application images rebuilt with Docker Engine **29.8.2** / Compose
**5.6.0**. The updated API/frontend containers were recreated using the existing
base runtime Compose configuration; all **seven services are healthy**. Runtime
inspection confirms patched `jws` **3.2.3**, `jwa` **1.4.2**, and no shipped
ESLint, Supertest or MongoDB memory-server tooling. Linux Go **1.26.5** vet and
race tests passed with actual Redis **7.4.7**: **11 top-level tests**, **13
authorization rejection subcases**, no skips or races. Python routing, GraphHopper
integration and Go tracking source remain unchanged.

Actual service acceptance passed before and after outage recovery: local campus
search -> GraphHopper walking route (**411.799 m**, **296.496 s**, **six
instructions**); Mongo/admin -> driver assignment -> short-lived Node grant ->
Go publish -> Redis -> WebSocket. Cross-vehicle grants and access-token
substitution are rejected without changing Redis latest state. Four existing
Chrome workflows passed (**52.0 s**, no skips): desktop/tablet/mobile viewports,
GPS-denied manual navigation, real admin UI, and real driver publishing/watch
cleanup/marker movement/stale handling. Network assertions continue to reject
public Nominatim and obsolete service calls. Visitor-location boundaries and
geolocation cleanup tests remain intact.

The existing finite simulator additionally passed three authorized writes,
matching Redis/WebSocket data and browser movement, actual **30-second stale**
and **120-second TTL/offline** behavior, expiry **404**, and marker removal.
The actual GraphHopper outage produced safe **503/504** errors and usable browser
controls; recovery and subsequent service acceptance passed with all seven
services healthy. Seven fresh screenshots were retained outside the repository;
the original tracked captures were restored byte-for-byte.

All local gates passed before the requested push. Maintenance commit
`6285052b8c415bfda44cefc5bfb4a3bcf4122e6b` was pushed to the existing public
repository's `main` branch by a normal fast-forward update, preserving upstream
history and visibility. Actual [hosted CI run 37218899561](https://github.com/guxinyihan/campus-compass/actions/runs/37218899561)
completed successfully:

| Hosted job | Observed maintenance result |
| --- | --- |
| frontend | Clean npm install, full install-time audit and explicit production high/critical audit gate: zero findings; lint, 28 tests in eight files and Vite production build passed |
| node-api | Actual MongoDB service initialized; clean npm install and both audits: zero findings; lint and all 14 tests passed |
| routing | Ruff lint/format, all 75 tests and campus data validation passed; one known test-client deprecation warning |
| tracking | Redis service initialized; Go vet and race command passed using a cached successful test result; fresh actual-Redis race coverage was verified separately in the local Linux run |
| repository | Full upstream history checkout, fresh environment initialization, Compose configuration, boundaries, tracked current-source/license scan and whitespace checks passed |

Final maintenance status: **DEPENDENCY_CLEANUP_COMPLETE**. There are no
remaining npm advisories or no-fix exceptions as of **2026-10-05**. ESLint 9
emits an upstream support-deprecation warning; retaining its compatible major
avoids unrelated plugin/lint migration. The final reporting commit receives its
own subsequent push and hosted-CI check, whose outcome is reported separately
without inventing a self-referential run ID in its source.
