#!/usr/bin/env node
// Optional demonstration: no direct Redis access or special authorization path.
import { setTimeout as delay } from 'node:timers/promises';

const apiUrl = (process.env.API_URL ?? 'http://localhost:4000').replace(/\/$/, '');
const trackingUrl = (process.env.TRACKING_URL ?? 'http://localhost:8081').replace(/\/$/, '');
const vehicleId = process.env.DEMO_VEHICLE_ID;
const email = process.env.DEMO_EMAIL;
const password = process.env.DEMO_PASSWORD;
const interval = Number(process.env.DEMO_INTERVAL_MS ?? 2000);
const maxSamples = Number(process.env.DEMO_SAMPLES ?? 0);

if (!vehicleId || !email || !password || !/^[A-Za-z0-9_-]{1,64}$/.test(vehicleId)) {
  console.error('Set DEMO_VEHICLE_ID, DEMO_EMAIL and DEMO_PASSWORD for an assigned fake driver.');
  process.exit(1);
}
if (!Number.isInteger(interval) || interval < 1000 || interval > 60000 || !Number.isInteger(maxSamples) || maxSamples < 0) {
  console.error('DEMO_INTERVAL_MS must be 1000..60000; DEMO_SAMPLES must be a nonnegative integer (0 runs until stopped).');
  process.exit(1);
}

// A deterministic loop inside the campus bounds. Register the vehicle with
// simulated:true so the map visibly labels these locations as simulated.
const loop = [
  [30.3531, 76.3645], [30.3533, 76.3647], [30.3535, 76.3649],
  [30.3537, 76.3651], [30.3535, 76.3653], [30.3533, 76.3651],
  [30.3531, 76.3649], [30.3529, 76.3647],
];
const stopped = new AbortController();
process.on('SIGINT', () => stopped.abort());
process.on('SIGTERM', () => stopped.abort());

async function request(url, body, token, method = 'POST') {
  const response = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.any([stopped.signal, AbortSignal.timeout(5000)]),
  });
  if (!response.ok) throw new Error(`Authorized demo request failed (${response.status}); check credentials, assignment and service health.`);
  return response.json();
}

try {
  console.log('DEMO / SIMULATED LIVE VEHICLE: only the authenticated tracking HTTP API is used.');
  const metadata = await request(`${apiUrl}/api/vehicles`, undefined, undefined, 'GET');
  if (!metadata.vehicles?.some(vehicle => vehicle.vehicleId === vehicleId && vehicle.simulated === true)) {
    throw new Error('Demo vehicle must be active and labeled simulated:true in administration metadata.');
  }
  const session = await request(`${apiUrl}/api/auth/login`, { email, password });
  if (!session.accessToken || session.user?.role !== 'driver') throw new Error('Demo account must be a server-authorized driver.');
  let trackingToken;
  let renewAt = 0;
  let samples = 0;
  while (!stopped.signal.aborted && (maxSamples === 0 || samples < maxSamples)) {
    if (Date.now() >= renewAt) {
      const grant = await request(`${apiUrl}/api/vehicles/${vehicleId}/tracking-token`, {}, session.accessToken);
      if (!grant.trackingToken || !Number.isFinite(grant.expiresIn) || grant.expiresIn <= 5 || grant.expiresIn > 120) throw new Error('Invalid short-lived tracking grant.');
      trackingToken = grant.trackingToken;
      renewAt = Date.now() + (grant.expiresIn - 5) * 1000;
    }
    const [lat, lng] = loop[samples % loop.length];
    await request(`${trackingUrl}/api/v1/vehicles/${vehicleId}/location`, { lat, lng, accuracy: 8 }, trackingToken);
    samples += 1;
    console.log(`Simulated position accepted (${samples}).`);
    if (maxSamples === 0 || samples < maxSamples) await delay(interval, undefined, { signal: stopped.signal });
  }
} catch (error) {
  if (!stopped.signal.aborted) {
    console.error(error instanceof Error ? error.message : 'Demo simulator stopped.');
    process.exitCode = 1;
  }
}
