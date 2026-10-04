// Runs against actual services; no fabricated engine, identity, Redis or WS.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const WebSocket = createRequire(new URL('../e2e/package.json', import.meta.url))('ws');
const api = process.env.API_URL || 'http://localhost:4000';
const routing = process.env.ROUTING_URL || 'http://localhost:5001';
const tracking = process.env.TRACKING_URL || 'http://localhost:8081';
async function call(base, path, {method = 'GET', body, token, expected = 200} = {}) {
  const response = await fetch(base + path, {method, headers: {...(body ? {'Content-Type': 'application/json'} : {}), ...(token ? {Authorization: `Bearer ${token}`} : {})}, ...(body ? {body: JSON.stringify(body)} : {})});
  assert.equal(response.status, expected, `${method} ${path} unexpected status`);
  return response.status === 204 ? null : response.json();
}
for (const base of [api, routing, tracking]) await call(base, '/health');
const pois = (await call(routing, '/api/pois?q=library')).pois;
assert.ok(pois.length > 0, 'Real local POI search must find a library');
const allPois = (await call(routing, '/api/pois')).pois;
const start = allPois.find(p => /hostel/i.test(p.name));
const destination = pois[0];
assert.ok(start, 'Campus hostel start must exist');
const route = await call(routing, '/api/routes', {method: 'POST', body: {start: {lat: start.lat, lng: start.lng}, destination: {lat: destination.lat, lng: destination.lng}, profile: 'walking'}});
assert.ok(route.geometry.coordinates.length > 1 && route.distanceMeters > 0 && route.durationSeconds > 0 && route.instructions.length > 0);
console.log('Real GraphHopper route passed:', {distanceMeters: route.distanceMeters, durationSeconds: route.durationSeconds, instructions: route.instructions.length});
if (!process.env.ADMIN_PASSWORD || !process.env.DEMO_PASSWORD) throw new Error('Private ADMIN_PASSWORD and DEMO_PASSWORD environment values required.');
const adminLogin = await call(api, '/api/auth/login', {method: 'POST', body: {email: 'admin@example.test', password: process.env.ADMIN_PASSWORD}});
const admin = adminLogin.accessToken;
const suffix = Date.now();
const student = await call(api, '/api/auth/register', {method: 'POST', expected: 201, body: {name: 'Acceptance Driver', email: `driver-${suffix}@example.test`, password: process.env.DEMO_PASSWORD}});
await call(api, '/api/admin/users', {token: student.accessToken, expected: 403});
await call(api, '/api/admin/users/' + student.user.id + '/role', {method: 'PATCH', token: admin, body: {role: 'driver'}});
const vehicle = (await call(api, '/api/admin/vehicles', {method: 'POST', token: admin, expected: 201, body: {displayName: 'DEMO / SIMULATED Campus Shuttle 1', code: `DEMO-${suffix}`, simulated: true, assignedDriver: student.user.id}})).vehicle;
const grant = await call(api, `/api/vehicles/${vehicle.vehicleId}/tracking-token`, {method: 'POST', token: student.accessToken});
const ws = new WebSocket(tracking.replace(/^http/, 'ws') + '/ws/vehicles', {headers: {Origin: process.env.FRONTEND_URL || 'http://localhost:5173'}});
await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, {once: true}); ws.addEventListener('error', reject, {once: true}); });
const nextLocation = () => new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('Real WebSocket broadcast timeout')), 10000);
  const listener = event => {
    const message = JSON.parse(event.data);
    if (message.type === 'vehicle.location' && message.vehicleId === vehicle.vehicleId) { clearTimeout(timer); ws.removeEventListener('message', listener); resolve(message); }
  }; ws.addEventListener('message', listener);
});
const broadcast = nextLocation();
await call(tracking, `/api/v1/vehicles/${vehicle.vehicleId}/location`, {method: 'POST', token: grant.trackingToken, body: {lat: start.lat, lng: start.lng, accuracy: 8}});
const event = await broadcast;
assert.equal(event.lat, start.lat); assert.equal(event.email, undefined); assert.equal(event.sub, undefined);
const latest = await call(tracking, `/api/v1/vehicles/${vehicle.vehicleId}`);
assert.equal(latest.vehicleId, vehicle.vehicleId);
await call(tracking, '/api/v1/vehicles/012345678901234567890123/location', {method: 'POST', token: grant.trackingToken, expected: 403, body: {lat: start.lat, lng: start.lng}});
await call(tracking, `/api/v1/vehicles/${vehicle.vehicleId}/location`, {method: 'POST', token: admin, expected: 401, body: {lat: start.lat, lng: start.lng}});
const snapshot = (await call(tracking, `/api/v1/vehicles/${vehicle.vehicleId}`));
assert.deepEqual(snapshot, latest, 'Rejected publish must leave Redis latest unchanged');
ws.close();
const notice = (await call(api, '/api/admin/notices', {method: 'POST', token: admin, expected: 201, body: {title: 'DEMO service notice', message: 'Simulated shuttle demonstration in progress.', severity: 'info', activeFrom: new Date(Date.now() - 60000).toISOString(), activeUntil: new Date(Date.now() + 3600000).toISOString()}})).notice;
assert.ok((await call(api, '/api/notices')).notices.some(n => n.id === notice.id));
console.log('Actual Mongo/admin -> Node driver grant -> Go -> Redis -> WebSocket acceptance passed. Demo metadata retained for screenshots.');
