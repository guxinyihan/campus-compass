// Optional synthetic demo setup via the same authenticated administration APIs.
const base = process.env.API_URL || 'http://localhost:4000';
const password = process.env.DEMO_PASSWORD;
const email = process.env.DEMO_EMAIL || 'driver@example.test';
if (!password || !process.env.ADMIN_PASSWORD || !email.endsWith('@example.test')) throw new Error('Private demo credentials and an example.test identity are required.');
async function call(path, method = 'GET', body, token, allowed = [200]) {
  const response = await fetch(base + path, {method, headers: {...(body ? {'Content-Type': 'application/json'} : {}), ...(token ? {Authorization: `Bearer ${token}`} : {})}, ...(body ? {body: JSON.stringify(body)} : {})});
  if (!allowed.includes(response.status)) throw new Error(`Demo setup operation failed (${response.status}).`);
  return response.json();
}
const admin = (await call('/api/auth/login', 'POST', {email: process.env.ADMIN_EMAIL || 'admin@example.test', password: process.env.ADMIN_PASSWORD})).accessToken;
await call('/api/auth/register', 'POST', {name: 'Demo Driver', email, password}, null, [201, 409]);
const driverLogin = await call('/api/auth/login', 'POST', {email, password});
if (driverLogin.user.role === 'admin') throw new Error('Demo identity must not be an admin.');
const driver = driverLogin.user;
await call(`/api/admin/users/${driver.id}/role`, 'PATCH', {role: 'driver'}, admin);
const vehicles = (await call('/api/admin/vehicles', 'GET', undefined, admin)).vehicles;
let vehicle = vehicles.find(v => v.assignedDriver === driver.id && v.active);
if (!vehicle) {
  const code = vehicles.some(v => v.code === 'DEMO-1') ? `DEMO-${Date.now()}` : 'DEMO-1';
  vehicle = (await call('/api/admin/vehicles', 'POST', {displayName: 'Campus Shuttle 1', code, simulated: true, assignedDriver: driver.id}, admin, [201])).vehicle;
}
if (!vehicle.simulated) throw new Error('Refusing to simulate an unlabeled vehicle.');
console.log('Synthetic driver and SIMULATED demo shuttle are ready.');
console.log('Set DEMO_VEHICLE_ID=' + vehicle.vehicleId + ' for scripts/simulate-shuttle.mjs. No credentials were printed.');
