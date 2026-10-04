import {before, after, test} from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import {MongoMemoryServer} from 'mongodb-memory-server';
import {createApp} from '../src/app.js';
import {loadConfig} from '../src/config.js';
import {User, Vehicle, initializeIndexes} from '../src/models.js';
import {accessToken} from '../src/auth.js';

const config = loadConfig({JWT_SECRET: 'test-access-secret-'.repeat(3), TRACKING_JWT_SECRET: 'test-tracking-secret-'.repeat(3)});
const password = 'Synthetic-Test-Passphrase-23';
const app = createApp(config, {limits: false});
let mongo, admin, adminToken, student, studentToken, driver, driverToken, vehicle;
const dbName = `campuscompass_test_${crypto.randomBytes(5).toString('hex')}`;
before(async () => {
  const uri = process.env.MONGO_TEST_URI || (mongo = await MongoMemoryServer.create({
    binary: {version: '8.0.18', downloadDir: path.resolve('../work/mongodb-binaries')},
  })).getUri();
  await mongoose.connect(uri, {dbName, serverSelectionTimeoutMS: 10000});
  await initializeIndexes();
  admin = await User.create({name: 'Synthetic Admin', email: 'admin@example.test', passwordHash: await bcrypt.hash(password, 12), role: 'admin'});
  adminToken = accessToken(admin, config);
}, {timeout: 300000});
after(async () => {
  if (mongoose.connection.readyState === 1) {
    assert.ok(mongoose.connection.name.startsWith('campuscompass_test_'));
    await mongoose.connection.dropDatabase();
  }
  await mongoose.disconnect();
  await mongo?.stop();
});
const auth = token => ({Authorization: `Bearer ${token}`});

test('registration always creates student and stores only bcrypt hash', async () => {
  const response = await request(app).post('/api/auth/register').send({name: 'Student', email: 'Student@EXAMPLE.test', password}).expect(201);
  student = response.body.user; studentToken = response.body.accessToken;
  assert.equal(student.role, 'student'); assert.equal(student.email, 'student@example.test');
  assert.equal(response.body.expiresIn, 900);
  const stored = await User.findById(student.id).select('+passwordHash');
  assert.notEqual(stored.passwordHash, password); assert.ok(await bcrypt.compare(password, stored.passwordHash));
  assert.equal(response.body.user.passwordHash, undefined);
});
test('public role/passwordHash injection is rejected, duplicate email conflicts', async () => {
  for (const role of ['driver', 'admin']) await request(app).post('/api/auth/register').send({name: 'Attacker', email: `${role}@example.test`, password, role}).expect(422);
  await request(app).post('/api/auth/register').send({name: 'Attacker', email: 'hash@example.test', password, passwordHash: 'raw'}).expect(422);
  await request(app).post('/api/auth/register').send({name: 'Student', email: 'student@example.test', password}).expect(409);
  await request(app).post('/api/auth/register').send({name: 'Long Unicode', email: 'long@example.test', password: '密'.repeat(30)}).expect(422);
});
test('login verifies password; me accepts only browser-purpose signed token', async () => {
  await request(app).post('/api/auth/login').send({email: student.email, password: 'x'.repeat(73)}).expect(422);
  await request(app).post('/api/auth/login').send({email: student.email, password: 'Wrong-Passphrase-23'}).expect(401);
  const response = await request(app).post('/api/auth/login').send({email: student.email, password}).expect(200);
  await request(app).get('/api/auth/me').set(auth(response.body.accessToken)).expect(200);
  await request(app).get('/api/auth/me').expect(401);
  const wrongType = jwt.sign({sub: student.id, tokenType: 'tracking'}, config.jwtSecret, {issuer: 'campuscompass-api', audience: 'campuscompass-browser', expiresIn: 60});
  await request(app).get('/api/auth/me').set(auth(wrongType)).expect(401);
  const expired = jwt.sign({sub: student.id, tokenType: 'access'}, config.jwtSecret, {issuer: 'campuscompass-api', audience: 'campuscompass-browser', expiresIn: -1});
  await request(app).get('/api/auth/me').set(auth(expired)).expect(401);
});
test('anonymous and student cannot use admin operations', async () => {
  await request(app).get('/api/admin/users').expect(401);
  await request(app).get('/api/admin/users').set(auth(studentToken)).expect(403);
  await request(app).post('/api/admin/vehicles').set(auth(studentToken)).send({displayName: 'Forbidden', code: 'NO'}).expect(403);
  await request(app).get('/api/admin/users').set(auth(adminToken)).expect(200);
});
test('admin establishes driver role and cannot assign admin through public role API', async () => {
  const created = await request(app).post('/api/auth/register').send({name: 'Driver', email: 'driver@example.test', password}).expect(201);
  driver = created.body.user; driverToken = created.body.accessToken;
  const promoted = await request(app).patch(`/api/admin/users/${driver.id}/role`).set(auth(adminToken)).send({role: 'driver'}).expect(200);
  assert.equal(promoted.body.user.role, 'driver');
  await request(app).patch(`/api/admin/users/${driver.id}/role`).set(auth(adminToken)).send({role: 'admin'}).expect(422);
  await request(app).patch(`/api/admin/users/${admin.id}/role`).set(auth(adminToken)).send({role: 'student'}).expect(403);
});
test('vehicle CRUD validates driver and keeps private assignment out of public API', async () => {
  await request(app).post('/api/admin/vehicles').set(auth(adminToken)).send({displayName: 'Bad', code: 'BAD', assignedDriver: student.id}).expect(422);
  const response = await request(app).post('/api/admin/vehicles').set(auth(adminToken)).send({displayName: 'Campus Shuttle 1', code: 'DEMO-1', assignedDriver: driver.id, simulated: true}).expect(201);
  vehicle = response.body.vehicle;
  assert.equal(vehicle.assignedDriver, driver.id);
  const publicList = await request(app).get('/api/vehicles').expect(200);
  assert.equal(publicList.body.vehicles[0].assignedDriver, undefined);
  assert.equal(publicList.body.vehicles[0].simulated, true);
  const updated = await request(app).patch(`/api/admin/vehicles/${vehicle.vehicleId}`).set(auth(adminToken)).send({displayName: 'DEMO Shuttle'}).expect(200);
  assert.equal(updated.body.vehicle.displayName, 'DEMO Shuttle');
});
test('driver uniqueness holds under concurrent assignments; assigned role cannot be demoted', async () => {
  const responses = await Promise.all(['DEMO-2', 'DEMO-3'].map(code => request(app).post('/api/admin/vehicles').set(auth(adminToken)).send({displayName: code, code, assignedDriver: driver.id})));
  assert.deepEqual(responses.map(r => r.status), [409, 409]);
  assert.equal(await Vehicle.countDocuments({assignedDriver: driver.id}), 1);
  await request(app).patch(`/api/admin/users/${driver.id}/role`).set(auth(adminToken)).send({role: 'student'}).expect(409);
});
test('concurrent role demotion and vehicle assignment preserve the driver invariant', async () => {
  for (let i = 0; i < 8; i++) {
    const candidate = await User.create({name: 'Race Driver', email: `race-${i}@example.test`, passwordHash: 'unused-test-hash', role: 'driver'});
    const results = await Promise.all([
      request(app).patch(`/api/admin/users/${i % 2 ? candidate.id.toUpperCase() : candidate.id}/role`).set(auth(adminToken)).send({role: 'student'}),
      request(app).post('/api/admin/vehicles').set(auth(adminToken)).send({displayName: 'Race Shuttle', code: `RACE-${i}`, assignedDriver: candidate.id}),
    ]);
    const current = await User.findById(candidate.id);
    const count = await Vehicle.countDocuments({assignedDriver: candidate.id});
    assert.equal(count, current.role === 'driver' ? 1 : 0);
    assert.ok(results.some(r => [409, 422].includes(r.status)));
  }
});
test('tracking issuance is short-lived purpose-bound driver-bound and vehicle-bound', async () => {
  await request(app).post(`/api/vehicles/${vehicle.vehicleId}/tracking-token`).set(auth(studentToken)).expect(403);
  const response = await request(app).post(`/api/vehicles/${vehicle.vehicleId}/tracking-token`).set(auth(driverToken)).expect(200);
  const claims = jwt.verify(response.body.trackingToken, config.trackingSecret, {algorithms: ['HS256'], issuer: 'campuscompass-api', audience: 'campuscompass-tracking'});
  assert.equal(claims.sub, driver.id); assert.equal(claims.vehicleId, vehicle.vehicleId); assert.equal(claims.role, 'driver'); assert.equal(claims.tokenType, 'tracking');
  assert.equal(claims.exp - claims.iat, 120);
  await request(app).get('/api/auth/me').set(auth(response.body.trackingToken)).expect(401);
  await request(app).post('/api/vehicles/012345678901234567890123/tracking-token').set(auth(driverToken)).expect(403);
  await request(app).patch(`/api/admin/vehicles/${vehicle.vehicleId}`).set(auth(adminToken)).send({active: false}).expect(200);
  await request(app).post(`/api/vehicles/${vehicle.vehicleId}/tracking-token`).set(auth(driverToken)).expect(403);
  await request(app).patch(`/api/admin/vehicles/${vehicle.vehicleId}`).set(auth(adminToken)).send({active: true}).expect(200);
});
test('service notices have real time windows, safe text and admin-only mutation', async () => {
  const now = Date.now();
  const payload = {title: 'Demo route notice', message: 'Synthetic notice', severity: 'info', activeFrom: new Date(now - 60000).toISOString(), activeUntil: new Date(now + 3600000).toISOString()};
  await request(app).post('/api/admin/notices').set(auth(studentToken)).send(payload).expect(403);
  const created = await request(app).post('/api/admin/notices').set(auth(adminToken)).send(payload).expect(201);
  const publicList = await request(app).get('/api/notices').expect(200);
  assert.equal(publicList.body.notices.length, 1);
  await request(app).post('/api/admin/notices').set(auth(adminToken)).send({...payload, activeUntil: payload.activeFrom}).expect(422);
  await request(app).patch(`/api/admin/notices/${created.body.notice.id}`).set(auth(adminToken)).send({...payload, message: 'Updated'}).expect(200);
  await request(app).delete(`/api/admin/notices/${created.body.notice.id}`).set(auth(adminToken)).expect(204);
  assert.equal((await request(app).get('/api/notices')).body.notices.length, 0);
});
test('unassignment releases unique slot and stops new tracking grants; deletion works', async () => {
  await request(app).patch(`/api/admin/vehicles/${vehicle.vehicleId}`).set(auth(adminToken)).send({assignedDriver: null}).expect(200);
  await request(app).post(`/api/vehicles/${vehicle.vehicleId}/tracking-token`).set(auth(driverToken)).expect(403);
  await request(app).patch(`/api/admin/users/${driver.id}/role`).set(auth(adminToken)).send({role: 'student'}).expect(200);
  await request(app).get('/api/driver/vehicles').set(auth(driverToken)).expect(403);
  await request(app).delete(`/api/admin/vehicles/${vehicle.vehicleId}`).set(auth(adminToken)).expect(204);
  await request(app).delete(`/api/admin/vehicles/${vehicle.vehicleId}`).set(auth(adminToken)).expect(404);
});
test('origin allowlist, malformed input and removed identity experiments fail safely', async () => {
  await request(app).get('/api/vehicles').set('Origin', 'https://evil.example.test').expect(403);
  const allowed = await request(app).get('/api/vehicles').set('Origin', 'http://localhost:5173').expect(200);
  assert.equal(allowed.headers['access-control-allow-origin'], 'http://localhost:5173');
  await request(app).post('/api/auth/register').set('Content-Type', 'application/json').send('{bad').expect(400);
  await request(app).post('/api/user/auth/firebase/callback').send({role: 'driver'}).expect(404);
});
test('health checks actual Mongo availability and liveness remains separate', async () => {
  await request(app).get('/health').expect(200);
  await mongoose.disconnect();
  await request(app).get('/health').expect(503);
  await request(app).get('/live').expect(200);
  await mongoose.connect(mongo?.getUri() || process.env.MONGO_TEST_URI, {dbName});
});
