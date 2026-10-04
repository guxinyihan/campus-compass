# CampusCompass API contracts

JSON fields use camelCase; coordinates in request objects are named `lat` and
`lng`, while GeoJSON arrays follow `[longitude, latitude]`. Errors have
`{error:{code,message}}`; validation details never include engine/DB bodies.
All services expose `/health` (critical-dependency readiness). Node, routing and
Go also expose `/live` for process liveness.

## Routing — port 5001

| Method/path | Input | Result |
|---|---|---|
| GET /api/campus | none | Canonical GeoJSON FeatureCollection with bounds and center |
| GET /api/pois | optional q and limit queries | `{pois:[{id,name,aliases,category,lat,lng}],total}` |
| POST /api/routes | `{start:{lat,lng},destination:{lat,lng},profile:"walking"}` | `{geometry,distanceMeters,durationSeconds,instructions,profile}` |

`geometry` is a LineString. Each instruction contains `text`, `point:{lat,lng}`,
`distanceMeters` and optional `landmark:{id,name,distanceMeters}`. Instruction
points start their segments; they are not segment endpoints.
The only supported profile is walking. Valid world coordinates must additionally
fall within lat 30.3491–30.3598, lng 76.3572–76.37529. The 0.001-degree margin
around campus declared bounds is about 111 m north/south and 96 m east/west.
GraphHopper receives `points:[[lng,lat],...]`, walking and unencoded geometry.
Its milliseconds are converted to seconds. Estimated duration is not a measured
ETA accuracy result. Timeout/unavailability/no-route/malformed data are safe
structured failures with distinct error codes.

## Identity/admin — port 4000

Protected endpoints require `Authorization: Bearer <accessToken>`. The server
checks the current Mongo user role on each protected request. Tokens remain
only in frontend memory and expire after 900 s; reload/logout removes that
browser session. No refresh cookie, server session or public OAuth callback.

| Method/path | Authorization | Input/result |
|---|---|---|
| POST /api/auth/register | public | name/email/password only; always student; returns user/accessToken/expiresIn |
| POST /api/auth/login | public | email/password; same response |
| GET /api/auth/me | signed in | `{user:{id,name,email,role}}` |
| GET /api/vehicles | public | `{vehicles:[{vehicleId,displayName,code,active,simulated}]}`; active only |
| GET /api/notices | public | `{notices:[{id,title,message,severity,activeFrom,activeUntil}]}`; current windows only |
| GET /api/admin/users | admin | `{users:[{id,name,email,role}]}` |
| PATCH /api/admin/users/:id/role | admin | `{role:"student"|"driver"}`; cannot change seeded admins; unassign before demotion |
| GET /api/admin/vehicles | admin | vehicle list plus assignedDriver ID/null |
| POST /api/admin/vehicles | admin | displayName/code; optional active/simulated/assignedDriver |
| PATCH /api/admin/vehicles/:vehicleId | admin | nonempty subset of creation fields; assignedDriver:null releases slot |
| DELETE /api/admin/vehicles/:vehicleId | admin | 204 on deletion |
| GET /api/admin/notices | admin | all bounded notices |
| POST /api/admin/notices | admin | title/message/severity/activeFrom/activeUntil; returns notice, 201 |
| PATCH /api/admin/notices/:id | admin | full validated notice replacement, same five fields |
| DELETE /api/admin/notices/:id | admin | 204 |
| GET /api/driver/vehicles | driver | assigned active vehicle list |
| POST /api/vehicles/:vehicleId/tracking-token | assigned driver | `{trackingToken,expiresIn:120}` |

Passwords require 12+ characters and at most 72 UTF-8 bytes to avoid bcrypt
truncation ambiguity. Strict schemas reject unknown keys including public role
or passwordHash injection. Database unique indexes protect email, vehicle code
and driver assignment under concurrent requests. Severity values: info, warning,
disruption. Notices inform visitors; they do not modify engine road closures.

## Tracking — port 8081

| Method/path | Authorization | Result |
|---|---|---|
| GET /api/v1/vehicles | public | `{vehicles:[position],staleAfterSeconds:30,ttlSeconds:120}` |
| GET /api/v1/vehicles/:vehicleId | public | latest position or 404 after expiry |
| POST /api/v1/vehicles/:vehicleId/location | tracking JWT | `{lat,lng,heading?,accuracy?}`; server-timestamped position |
| WS /ws/vehicles | public, allowed browser origin | snapshot then accepted location events |

Position contains vehicleId, lat, lng, receivedAt and optional heading/accuracy.
No driver identity/email/phone/token is present. Vehicle IDs are Mongo IDs.
The initial event is `{type:"vehicle.snapshot",vehicles,...freshnessSettings}`;
updates are `{type:"vehicle.location",...position}`. Latest-only Redis keys are
`vehicle:<vehicleId>:latest`, expire after 120 s, and are never stored in Mongo.
Frontend classifies live (under 30 s), stale (30–120 s), offline (120+ s or no
snapshot). Native/production transports are real WebSockets, not HTTP polling.

Tracking JWT must use HS256 with distinct TRACKING_JWT_SECRET, issuer
campuscompass-api, audience campuscompass-tracking, `sub` user ID, `role:driver`,
`vehicleId` equal URL, `tokenType:tracking`, iat/exp and lifetime <=120 s.
Access/expired/non-driver/cross-vehicle grants cannot write or broadcast. Redis
Lua applies latest position with TTL and publishes atomically; all server
broadcasts follow accepted Redis events. HTTP requests reject unsafe origins
and the WS upgrade checks the explicit origin allowlist.

## Operational limits

Driver/assignment/deactivation changes stop new grants immediately. Previously
issued tracking JWTs can remain usable until their <=120 s expiry; Go does not
query Mongo or maintain a revocation database. Public snapshot may therefore
retain the last authorized position until TTL. Admin operations and rate limits
are designed for a local portfolio demonstration; auth rate counters are per
Node process. Role/assignment mutations are serialized per driver within this
single Node process, so concurrent demotion and assignment cannot leave a
student assigned. Multiple Node instances require transactional administration
with a Mongo replica set before deployment. No measured production scaling or
availability claim is made.

Visitor GPS never goes to Node/Mongo/Redis/Go. Routing receives origin coordinates
only on explicit route/reroute actions. Engine request logs are disabled. Tile
requests are external when using public OSM tiles; see provenance/policy docs.
