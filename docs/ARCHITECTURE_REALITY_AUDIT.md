# Architecture reality audit — upstream foundation

Inspected source: `1d5420787b2f5a7a42b2a9ce17792ed7f97149fc`. All references
below resolve at that immutable revision, including files later removed. This
is an audit of inherited MapMitra, not a claim about final CampusCompass.

Classification: IMPLEMENTED = reachable source; PARTIAL = meaningful but
incomplete code; ABSENT = no implementation; BROKEN = demonstrated source
defect/baseline failure; UNVERIFIED = runtime evidence unavailable;
DOCUMENTATION-ONLY = prose/examples without corresponding runtime.

## Claim matrix

| Claimed component | Classification | Source evidence / limitation |
|---|---|---|
| React/Leaflet frontend | IMPLEMENTED; baseline BROKEN | `frontend/src/main.jsx`, `App.jsx`, `components/MapComponent.jsx`; npm lock does not satisfy npm ci |
| Campus search | PARTIAL / policy defect | `MapComponent.jsx:257-274` calls public Nominatim on input changes instead of canonical campus index |
| Geolocation | PARTIAL / lifecycle BROKEN | `MapComponent.jsx:68-92,182-199` create watches without corresponding cleanup; third navigation watch overlaps |
| GraphHopper routing | PARTIAL, runtime UNVERIFIED | `routing-backend/api/app.py`; engine request exists, lacks robust validation/timeouts; no full-stack acceptance |
| Landmark navigation | PARTIAL | `routing-backend/api/landmark.py`, `app.py`; geometry processing exists, instruction fallbacks fragile |
| Wheelchair/accessibility routes | DOCUMENTATION-ONLY | GraphHopper config has foot profile; no separately validated wheelchair profile or accessibility dataset audit |
| Real-time shuttle tracking | ABSENT / fake UI | `MapComponent.jsx:98-110` uses httpbin plus hardcoded positions; location polling targets unimplemented Go endpoint |
| ETA prediction / 90% accuracy | DOCUMENTATION-ONLY | No model/evaluation dataset/test; Go stores ride request state, not measured ETA |
| WebSocket tracking | ABSENT | `quinjet/cmd/api/api.go:25-41`, `internal/services/rides/rides.go:25-31`; no upgrade handler/dependency |
| Redis | IMPLEMENTED for ride queues | `rides.go:63-100`; not live-location storage, expiry commented out |
| Quinjet | IMPLEMENTED HTTP experiment | Main creates Redis and HTTP routes, worker disabled `cmd/main.go:24-25` |
| Ride matching | PARTIAL / BROKEN state | `actions.go:65-89` deletes request before SETNX; decline reads deleted hash at `:129-135` |
| Driver location publishing / driver app | ABSENT | No location routes or authorized driver API in Go; frontend target not implemented |
| MongoDB | PARTIAL | Node db/User modules exist; no connected admin vehicle/notices schema |
| Authentication | BROKEN | Missing middleware import path, export mismatch, missing jwt import and `_id`/`id` disagreement |
| Google OAuth | BROKEN | Passport named User import conflicts with default export; created user omits required phone/role |
| Firebase authentication | ABSENT verified identity / unsafe callback | `user.controllers.js` trusts body phone/name/role without Firebase ID-token verification |
| Admin dashboard | PARTIAL placeholders | `frontend/src/pages/Admin.jsx`; external road submission, placeholder sections |
| Driver management | DOCUMENTATION-ONLY | No authenticated local vehicle/assignment CRUD in Node source |
| Dynamic road blocking | PARTIAL UI, integration ABSENT | Frontend drawing posts externally, no tested change to local GraphHopper routes |
| Emergency alerts | DOCUMENTATION-ONLY | No authorized persistent alert workflow |
| Recommendations | DOCUMENTATION-ONLY | No recommendation algorithm/API in active services |
| Docker Compose | PARTIAL | Root file contains only GraphHopper/Python/Redis/Quinjet, omits frontend/Node/Mongo |
| Health checks | PARTIAL / misleading | Quinjet always says ok, routing dependency readiness absent, Node endpoint absent |
| CI/CD | ABSENT | No `.github/workflows` at foundation; README pipeline diagram is not a run |
| Production deployment | UNVERIFIED | Hardcoded upstream URLs do not prove deployed correctness/security |
| Seven fully integrated services | DOCUMENTATION-ONLY | Root Compose and broken source contradict a complete seven-service runtime |
| 15+ working API endpoints | UNVERIFIED / unsupported count | Documentation lists shapes not registered consistently; source has broken imports and missing WS/location APIs |
| Scalable infrastructure | UNVERIFIED | No load measurements, replication tests or verified operational deployment |

## Previously reported defects, individually checked

| # | Finding |
|---|---|
| 1 | Confirmed: root Compose has four services and omits React/Node/Mongo. |
| 2–4 | Confirmed: Node default 5000, Python Docker 5000; docs quick-start lists both on 5000. |
| 5 | Confirmed: frontend source uses routing/glts/route upstream cloud hosts. |
| 6 | Confirmed: axios interceptor logs request metadata/payloads. |
| 7–8 | Confirmed: nearby marker effect calls httpbin then installs three fixed coordinate records. |
| 9 | Confirmed: user ride request identifier is literal `user1`. |
| 10–11 | Confirmed: frontend status uses query argument while Go expects path ID; autoID/autoId mismatch; location API absent. |
| 12 | Confirmed: registered Quinjet routes are HTTP ride routes, no WS tracking. |
| 13 | Confirmed: accept deletes metadata before lock; decline expects that deleted metadata. No atomic lifecycle. |
| 14–15 | Confirmed: no meaningful driver authentication; `cors.Default()` instead of product origin allowlist. |
| 16–17 | Confirmed public autocomplete call; [OSMF policy](https://operations.osmfoundation.org/policies/nominatim/) explicitly disallows this use. |
| 18–20 | Confirmed multiple watchers, missing cleanup and route effect dependency on userLocation. |
| 21–24 | Confirmed blocking requests.post in async FastAPI; no explicit timeout, raw error details and broad CORS. |
| 25 | Confirmed GeoJSON copies have different hashes/features; see data audit. |
| 26–27 | No proven wheelchair profile or ETA evaluation; claims unsupported. |
| 28–29 | Confirmed placeholders and external road-drawing submission without integrated route closure. |
| 30 | Confirmed conflicting OAuth/Firebase-style identity paths and broken local contracts. |
| 31 | Confirmed `User.models.js` token helpers reference jwt without importing it. |
| 32 | Confirmed Passport named User import while model exports default. |
| 33 | Confirmed lowercase user.models and asyncHandler imports differ from filesystem casing; user.routes also imports nonexistent auth.middleware.js. |
| 34 | Confirmed token signs `_id`; middleware queries decodedToken.id. |
| 35 | Confirmed OAuth creation lacks schema-required phone and role. |
| 36 | Confirmed callback trusts phone/name and permits client-selected **driver/visitor**, not admin. Public self-assignment to driver is itself unacceptable. Do not falsely claim this endpoint accepts admin. |
| 37–38 | Confirmed raw refreshToken stored in user record; no complete rotation/reuse detection implementation. |
| 39 | Confirmed express-session default store is active; no production session-store configuration. |
| 40 | Confirmed ISC package metadata while root MIT governs code; history and correction described below. |

## Package metadata history

`git log --follow -- backend/package.json` shows ISC present in uploaded package
manifests; fields such as empty author/description and `version:1.0.0` resemble
npm defaults. This supports **an inference**, not proof of how npm was invoked.
Root LICENSE has been MIT since `196296a`; `7af0efb` expanded its notice to
Copyright (c) 2024 Yash Dogra. No separate backend ISC LICENSE/copyright grant
exists. CampusCompass aligns backend package metadata with canonical root MIT,
preserves that root file byte-for-byte and does not invent another owner.

## Decisions

Retain React/Leaflet, campus data, Python/GraphHopper and the deterministic
landmark concept. Replace inconsistent auth with local email/password and
short-lived access tokens; remove active OAuth/Firebase experiments. Replace
Quinjet ride state with dedicated ephemeral vehicle tracking. Remove mockbackend,
fake nearby shuttles, fake road closures, recommendations and emergency claims.
Implement bounded authenticated vehicle/driver/notices administration.

No physical accessibility claim is released without audited data. No simulated
vehicle is described as actual campus operations. Baseline and later test
results are reported separately; mocks do not establish live integration.
