# CampusCompass development plan

Foundation: full-history upstream main `1d5420787b2f5a7a42b2a9ce17792ed7f97149fc`.
Source inspections and baselines precede implementation. Audits are snapshots
of the foundation, not descriptions of the finished application.

Completion recorded 2026-10-04: implementation, native checks, the complete
seven-service container stack, real GraphHopper/browser/Redis/WebSocket
acceptance and all five hosted CI jobs passed before final reporting. Published
repository: [guxinyihan/campus-compass](https://github.com/guxinyihan/campus-compass).
See [validation evidence](docs/VALIDATION.md) for observed results and limits.

## Boundaries and data ownership

| Active component | Responsibility | Host port |
|---|---|---|
| React/Vite/Leaflet frontend | Anonymous navigation, browser-local GPS, public shuttle view, driver/admin forms | 5173 |
| Node/Express API | Password authentication, server-controlled roles, vehicles/assignments, notices, purpose-bound tracking JWT issuance | 4000 |
| MongoDB | Identity and administration metadata; no GPS history | 27017 (internal) |
| Python/FastAPI routing API | Validated campus data, one POI index, async GraphHopper client, deterministic landmark augmentation | 5001 |
| GraphHopper 10.2 / Java 21 | Walking route engine using the repository OSM extract | 8989 (internal) |
| Go tracking service | Authorized location writes, public latest snapshots, Redis pub/sub to actual WebSockets | 8081 |
| Redis | Temporary latest vehicle location and pub/sub; TTL 120 seconds | 6379 (internal) |

Rewrite the broken active Node authentication as one access-token-only design;
retain the folder and upstream Git history. Replace active Quinjet ride matching
with bounded live tracking in `tracking/`. Delete incomplete ride/OAuth/Firebase,
road-drawing, mockbackend and placeholder UI from the active tree. Historical
code remains inspectable at the foundation commit. Do not add queues, AI,
Kubernetes, predictive ETA, or new services.

## Contracts

All JSON uses camelCase. Safe errors use `{error:{code,message}}`.
The definitive endpoint specification will be `docs/API_CONTRACTS.md`.

- Routing `GET /api/pois?q=...`, `GET /api/campus`, `POST /api/routes`.
  Route input: `{start:{lat,lng},destination:{lat,lng},profile:"walking"}`.
  Output: GeoJSON LineString geometry (`[longitude,latitude]`), distanceMeters,
  durationSeconds, profile and instructions with point/text/distanceMeters.
- Identity `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`.
  Public registration accepts name/email/password only and creates student.
- Public `GET /api/vehicles`, `GET /api/notices`.
- Admin vehicle CRUD, driver role/assignment and notice CRUD under `/api/admin`.
- Assigned driver `POST /api/vehicles/:vehicleId/tracking-token`.
- Tracking `GET /api/v1/vehicles`, `GET /api/v1/vehicles/:vehicleId`,
  `POST /api/v1/vehicles/:vehicleId/location`, `WS /ws/vehicles`.
  Input `{lat,lng,heading?,accuracy?}`; output only vehicleId/coordinates/server
  receivedAt and optional heading/accuracy. Never publish account records.
- `/health` returns 503 when a critical dependency is unavailable; `/live` may
  distinguish process liveness where provided.

Tracking JWT uses HS256, distinct >=32-character secret, issuer
`campuscompass-api`, audience `campuscompass-tracking`, subject user ID,
`role:"driver"`, `vehicleId`, `tokenType:"tracking"`, iat/exp and 120-second
maximum lifetime. Access JWT has separate audience/type and 15-minute lifetime.
Role/assignment changes stop new issuance; existing tracking grants can remain
valid until their short expiry (document this bounded revocation delay).

## Implementation milestones

1. Record upstream delta, source reality, exact licensing evidence and baseline
   failures. Commit these documents without changing the root LICENSE.
2. Add executable regression assertions for unsafe inherited hosts, public
   autocomplete, missing watch cleanup and insecure identity boundaries;
   run against the foundation and record expected failure before replacements.
3. Make `data/campus.geojson` and `data/campus.osm` authoritative. Validate
   geometries, coordinates, named POIs, duplicate names, bounds and OSM input.
   Serve campus data from routing API; do not ship a second frontend index.
4. Implement explainable exact/prefix/word-prefix/substring POI ranking and
   safe async routing. Use Haversine landmark distances within 45 m and preserve
   original instruction when no suitable landmark exists.
5. Split frontend map, forms and hooks. GPS is opt-in, has one watch with cleanup,
   inline permission/error/accuracy state, and remains browser-local except
   deliberate route requests. Explicit rerouting is the initial policy; any
   automatic deviation policy requires independent noise/cooldown tests.
6. Implement password hashing, in-memory browser access token, strict request
   fields, backend role checks, unique driver assignments and secure admin seed.
7. Implement Go Redis latest-position writes with server time/TTL, claim checking,
   origin allowlist, actual pub/sub WebSocket updates, concurrency/error tests.
8. Connect frontend snapshots/WebSockets/stale/offline states and authenticated
   driver publishing. Provide optional labeled simulator using the same API.
9. Compose all seven used services with distinct ports, internal database URLs,
   named volumes, readiness checks and explicit secret configuration.
10. Verify domain tests and actual Mongo/Redis/GraphHopper separately, then run
    browser workflows/screenshots at desktop/tablet/mobile sizes. Only rewrite
    README around source and validation evidence after implementation.
11. Add meaningful hosted checks, inspect final diff, secret/license/host scans,
    preserve history and commit milestones. Publish only after release gates.

## Licensing and privacy

Root code license is MIT, Copyright (c) 2024 Yash Dogra. Backend ISC metadata
appeared with default-looking npm fields; root MIT existed first and was later
explicitly expanded to the author's full name. No separate ISC license is
present. Align package metadata with the canonical MIT and document that this
is a consistency correction, not proof of the author's npm initialization.

OSM-derived databases and generated POI data retain ODbL/provenance notices;
GraphHopper is Apache 2.0. Do not infer original ownership of incomplete JOSM
edits. Visible OSM attribution stays in Leaflet and data documentation. Public
Nominatim autocomplete is removed entirely. Public tiles remain a configurable
internet dependency; never prefetch/bulk-cache them.

No visitor GPS is sent to auth/Mongo/Redis/tracking. Driver locations are public
shuttle information only, stored latest-only in Redis and expired after 120 s.
No production GPS history or real student/driver accounts are used.

## Verification and release gates

Frontend: lint, Vitest/RTL and production build; search, denial/watch cleanup,
route failures, progress, WebSocket and stale state, logout/admin visibility.
Node: node:test/Supertest with disposable actual MongoDB; hash/login/default role,
escalation, admin CRUD, assignments, notices and tracking issuance.
Python: pytest and Ruff; fixtures for conversion, bounds, ranking, landmarks,
timeout/no-path/malformed engine data and health. Actual local GraphHopper is
reported separately from mocked tests. Go: testing/miniredis, race checks where
supported, actual Redis integration, all token rejection cases, TTL and real WS.

Require `docker compose config`, build/start/health acceptance when tooling is
available, and the user-requested actual **container** GraphHopper acceptance.
Native runtime evidence cannot substitute for container acceptance. At the
initial audit this host had no usable Docker daemon or configured WSL. Authorized
setup subsequently provided a dedicated WSL Docker Engine, and the actual
container gate passed; the initial environment constraint is now resolved.
GitHub credentials are verified through authorized credential access; initial
sandbox auth failure was an access restriction, not an invalid account.

Do not publish, claim hosted CI success, or write FINAL_REPORT.md while mandatory
release gates remain unverified. Maintain a factual validation/status document
and runnable acceptance scripts so missing environment checks can be resumed.
