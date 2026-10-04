// Real simulator + HTTP/Redis/WebSocket/browser acceptance; takes ~125 seconds.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {chromium, expect} from '@playwright/test';
import WebSocket from 'ws';
import path from 'node:path';

const api = process.env.API_URL || 'http://localhost:4000';
const tracking = process.env.TRACKING_URL || 'http://localhost:8081';
const frontend = process.env.FRONTEND_URL || 'http://localhost:5173';
const metadata = await (await fetch(api + '/api/vehicles')).json();
const vehicle = metadata.vehicles.find(v => v.vehicleId === process.env.DEMO_VEHICLE_ID)
  || metadata.vehicles.find(v => v.displayName === 'Campus Shuttle 1' && v.simulated);
assert.ok(vehicle?.simulated, 'Seed the assigned synthetic demo first');
const events = [];
const ws = new WebSocket(tracking.replace(/^http/, 'ws') + '/ws/vehicles', {headers: {Origin: frontend}});
ws.on('message', data => {
  const event = JSON.parse(data.toString());
  if (event.type === 'vehicle.location' && event.vehicleId === vehicle.vehicleId) events.push(event);
});
await new Promise((resolve, reject) => {ws.once('open', resolve); ws.once('error', reject);});
const browser = await chromium.launch({headless: true, ...(process.env.CHROME_PATH ? {executablePath: process.env.CHROME_PATH} : {})});
let simulator;
try {
  const page = await browser.newPage({viewport: {width: 1440, height: 1000}});
  await page.goto(frontend);
  await expect(page.locator('.connection')).toHaveText('connected');
  const row = page.locator('.vehicle-list li').filter({has: page.getByText(vehicle.displayName, {exact: true})});
  await expect(row).toContainText('Simulated demo');
  simulator = spawn(process.execPath, ['--env-file=.env', 'scripts/simulate-shuttle.mjs'], {
    cwd: path.resolve('..'),
    env: {...process.env, DEMO_VEHICLE_ID: vehicle.vehicleId, DEMO_SAMPLES: '3', DEMO_INTERVAL_MS: '2000'},
    stdio: 'ignore',
  });
  const completed = new Promise((resolve, reject) => {simulator.once('exit', code => code === 0 ? resolve() : reject(new Error('Simulator failed'))); simulator.once('error', reject);});
  await expect.poll(() => events.length, {timeout: 15000}).toBeGreaterThanOrEqual(1);
  const marker = page.locator('path[stroke="#167047"]').last();
  await expect(marker).toBeVisible();
  const firstPath = await marker.getAttribute('d');
  await completed;
  await expect.poll(() => events.length, {timeout: 10000}).toBe(3);
  await expect.poll(() => marker.getAttribute('d')).not.toBe(firstPath);
  assert.equal(events[2].lat, 30.3535);
  assert.equal(events[2].lng, 76.3649);
  for (const event of events) {
    assert.deepEqual(Object.keys(event).sort(), ['accuracy', 'lat', 'lng', 'receivedAt', 'type', 'vehicleId']);
  }
  const latest = await (await fetch(`${tracking}/api/v1/vehicles/${vehicle.vehicleId}`)).json();
  assert.equal(latest.lat, events[2].lat);
  assert.equal(latest.lng, events[2].lng);
  await expect(row.locator('.status')).toHaveText('live');
  console.log('Actual simulator: three authorized HTTP writes, matching Redis snapshot, public WebSocket events and moving browser marker passed.');
  await expect(row.locator('.status')).toHaveText('stale', {timeout: 40000});
  console.log('Stopped simulator: actual browser stale state after 30 seconds passed.');
  await expect(row.locator('.status')).toHaveText('offline', {timeout: 100000});
  await expect.poll(async () => (await fetch(`${tracking}/api/v1/vehicles/${vehicle.vehicleId}`)).status, {timeout: 5000}).toBe(404);
  await expect(page.locator('path[stroke="#167047"], path[stroke="#967128"]')).toHaveCount(0);
  await page.screenshot({path: path.resolve('../docs/screenshots/shuttle-offline.png'), fullPage: true});
  console.log('Actual 120-second TTL: public latest endpoint returns 404 and browser removes expired markers while metadata remains offline.');
} finally {
  if (simulator && simulator.exitCode === null) simulator.kill();
  ws.close();
  await browser.close();
}
