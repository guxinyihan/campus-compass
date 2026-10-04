# CampusCompass frontend

React 18, Vite and React Leaflet provide anonymous campus walking navigation and the public shuttle demonstration. The MIT upstream notice is preserved at the repository root; campus data licensing is separate.

## Run and verify

With Node 24 and the APIs running on their documented ports:

```sh
npm ci --ignore-scripts
npm run dev
npm test
npm run lint
npm run build
```

The development server is http://localhost:5173. By default Vite proxies `/identity` to Node :4000, `/routing` to FastAPI :5001 and `/tracking` (including WebSockets) to Go :8081. Compose builds a static nginx frontend using explicit public API URLs. Docker acceptance is a separate release gate; a successful Vite build does not prove the container stack works.

## Configuration

All VITE values are public, build-time configuration, never secrets:

| Variable | Default | Purpose |
|---|---|---|
| VITE_API_URL | /identity | Node identity, metadata and administration |
| VITE_ROUTING_API_URL | /routing | Canonical campus data, POIs and walking routes |
| VITE_TRACKING_API_URL | /tracking | Latest public vehicle positions and authorized driver writes |
| VITE_TRACKING_WS_URL | /tracking/ws/vehicles | Public WebSocket; supports relative and ws/wss URLs |
| VITE_TILE_URL | https://tile.openstreetmap.org/{z}/{x}/{y}.png | Configurable online map tiles |
| VITE_TILE_ATTRIBUTION | OpenStreetMap contributors link | Visible attribution; preserve OSM credit for OSM tiles |

Public tiles need internet; application search/routing/auth/tracking use local services. Leaflet JavaScript and CSS are bundled. There is no CDN script dependency, public geocoder autocomplete or client tile prefetching.

## Navigation and privacy

`Navigate` fetches the routing-owned POI index once and ranks exact, prefix, word-prefix and substring matches locally, including aliases and stable name/ID ties. There is no bundled second GeoJSON or search index. A campus POI start works when GPS is denied or unavailable.

Browser location is opt-in. `useGeolocation` owns one watch, including valid watch ID zero, and clears it on stop, mode change, navigation end and unmount. Permission denial, temporary errors, timeout and unsupported browsers have inline messages. Location accuracy is displayed. Normal visitor fixes stay in memory in the browser; only a deliberate route or reroute request sends start coordinates to the routing service.

`useRoute` cancels superseded requests. GPS callbacks never initiate route requests. Route geometry stays intact. GraphHopper instruction points start their segments: the current direction remains visible until a fix is within 15 m of the next instruction point, with reported accuracy within 50 m. Approximate distance to the nearest segment detects deviation after three consecutive fixes more than max(35 m, reported accuracy) from the route. Poor fixes reset the deviation count. Rerouting is explicitly requested by the user; there is no automatic route loop or automatic arrival shutdown.

Walking is the only supported profile. Accessibility conditions and predictive ETA accuracy have not been established.

## Live vehicle demonstration

`useVehicles` loads an initial latest-position snapshot and subscribes to the actual Go WebSocket. Once a WS frame arrives, any delayed HTTP bootstrap is ignored. Every WS snapshot (including reconnects) replaces the position set, and valid location events follow Redis publication order even if request timestamps are equal or inverted. Age is computed from server `receivedAt`: live before 30 seconds, stale until 120 seconds, then offline. Expired markers disappear; active metadata can remain as an offline row. Closed sockets reconnect with bounded backoff and all resources are released on unmount. Metadata/notices refresh every 30 seconds; location updates are delivered over WS.

The map renders only server-supplied positions for active metadata vehicles. Simulated vehicles are labeled. A disconnected feed is visible, and the UI does not invent replacement coordinates.

## Identity and administration

Access tokens and short-lived tracking grants stay in browser memory. Reloading requires signing in again. Public registration has no role selector and sends name/email/password only. Server-issued roles control page visibility, while the Node API remains the authorization boundary. Logout and access-token expiration unmount protected pages immediately.

Administrator forms support student/driver role changes, vehicle creation/edit/deletion, unique driver assignments, scheduled notice CRUD and dependency health checks. Existing admin users cannot be promoted through the public application.

The driver page lists server-authorized assignments. Uploading is a separate explicit action and uses a vehicle-bound tracking token, never the access token at Go. It submits at most every 5 seconds, renews grants before their 120-second expiration and requires a recent fix within 100 m accuracy. Authorization failures stop publishing and release the watch. Stopping/signing out/unmounting cancels pending writes and timers. Redis retains latest vehicle location only, with a 120-second TTL. There are no visitor uploads to the tracking API and no ride matching.

## Tests

Vitest and React Testing Library cover search ranking, nearest-route calculations, instruction progress, deviation noise, opt-in GPS/error/watch cleanup, deliberate route requests, first instructions, stale response cancellation, real WS frame handling/reconnection/expiry, protected admin visibility and logout, strict registration forms, admin service payloads and driver publishing lifecycle. Real GraphHopper, Mongo/Redis, browser and container acceptance evidence lives in the root validation documents.
