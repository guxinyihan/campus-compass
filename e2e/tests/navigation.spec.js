import {test, expect} from '@playwright/test';
import path from 'node:path';
import {randomUUID} from 'node:crypto';

const screenshots = path.resolve('../docs/screenshots');
test('actual anonymous campus search, engine-backed route and responsive screenshots', async ({page}) => {
  const requests = [];
  page.on('request', request => requests.push(request.url()));
  await page.goto('/');
  await expect(page.getByRole('heading', {name: 'Find your way'})).toBeVisible();
  const origin = page.getByRole('combobox', {name: 'Start at a campus place'});
  await origin.fill('hostel');
  await page.getByRole('option').first().locator('button').click();
  const destination = page.getByRole('combobox', {name: 'Destination'});
  await destination.fill('library');
  await page.getByRole('option').first().locator('button').click();
  await page.getByRole('button', {name: 'Calculate walking route'}).click();
  await expect(page.getByRole('region', {name: 'Walking directions'})).toBeVisible();
  await expect(page.locator('.leaflet-overlay-pane path').first()).toBeVisible();
  expect(requests.some(url => /nominatim|httpbin|shouryadoes/.test(url))).toBe(false);
  for (const [name, width, height] of [['desktop-route', 1440, 1000], ['tablet-map', 834, 1112], ['mobile-map', 390, 844]]) {
    await page.setViewportSize({width, height});
    await page.waitForTimeout(500);
    await expect(page.getByRole('button', {name: 'End navigation'})).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({path: path.join(screenshots, `${name}.png`), fullPage: true});
  }
  await page.getByRole('button', {name: 'End navigation'}).click();
});

test('denied location leaves manual campus navigation usable', async ({page}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'geolocation', {value: {
      watchPosition(_success, error) {error({code: 1}); return 0;}, clearWatch() {},
    }});
  });
  await page.goto('/');
  await page.getByRole('button', {name: 'Use my browser location'}).click();
  await expect(page.locator('.location-message')).toContainText(/denied|blocked|permission/i);
  await expect(page.getByRole('combobox', {name: 'Start at a campus place'})).toBeEnabled();
});

test('real admin promotes a driver, manages assigned vehicles and scheduled notices through UI', async ({page, request}) => {
  test.skip(!process.env.ADMIN_PASSWORD || !process.env.DEMO_PASSWORD, 'Private ADMIN_PASSWORD and DEMO_PASSWORD required for actual admin acceptance.');
  test.setTimeout(90000);
  const suffix = randomUUID().slice(0, 8);
  const driverName = `Browser Demo ${suffix}`;
  const email = `e2e-admin-${suffix}@example.test`;
  const registration = await request.post(`${process.env.IDENTITY_URL || 'http://localhost:4000'}/api/auth/register`, {
    data: {name: driverName, email, password: process.env.DEMO_PASSWORD},
  });
  expect(registration.status()).toBe(201);
  const {user} = await registration.json();
  expect(user.role).toBe('student');
  const vehicleCode = `E2E-${suffix.toUpperCase()}`;
  const vehicleName = `Browser Demo Shuttle ${suffix}`;
  const updatedVehicleName = `${vehicleName} updated`;
  const noticeTitle = `Browser Demo Notice ${suffix}`;
  const updatedNoticeTitle = `${noticeTitle} updated`;

  await page.goto('/');
  await page.locator('summary').filter({hasText: /^Sign in$/}).click();
  await page.getByLabel('Email', {exact: true}).fill('admin@example.test');
  await page.getByLabel('Password', {exact: true}).fill(process.env.ADMIN_PASSWORD);
  await page.getByRole('button', {name: 'Sign in', exact: true}).click();
  await expect(page.getByRole('button', {name: 'Sign out'})).toBeVisible();
  await page.getByRole('link', {name: 'Administration', exact: true}).click();
  await expect(page.getByRole('heading', {name: 'Campus operations'})).toBeVisible();
  const vehicleSection = page.locator('.workspace-card').filter({has: page.getByRole('heading', {name: 'Vehicles and driver assignments', exact: true})});
  const noticeSection = page.locator('.workspace-card').filter({has: page.getByRole('heading', {name: 'Campus service notices', exact: true})});
  const accountRow = page.locator('tbody tr').filter({has: page.getByText(email, {exact: true})});
  await expect(accountRow).toBeVisible();
  await expect(accountRow.locator('td').nth(1)).toHaveText('student');

  const save = async (action, endpoint, method) => {
    const pending = page.waitForResponse(response => response.request().method() === method && new URL(response.url()).pathname.endsWith(endpoint));
    await action();
    const response = await pending;
    expect(response.status()).toBeGreaterThanOrEqual(200);
    expect(response.status()).toBeLessThan(300);
    await expect(page.getByText('Saved successfully.', {exact: true})).toBeVisible();
    return response;
  };
  await accountRow.getByLabel(`Role for ${driverName}`).selectOption('driver');
  await save(() => accountRow.getByRole('button', {name: 'Update role'}).click(), `/api/admin/users/${user.id}/role`, 'PATCH');
  await expect(accountRow.locator('td').nth(1)).toHaveText('driver');

  const createVehicle = vehicleSection.locator('details').filter({has: page.locator('summary').filter({hasText: /^Create vehicle$/})});
  await createVehicle.locator('summary').click();
  await createVehicle.getByLabel('Display name').fill(vehicleName);
  await createVehicle.getByLabel('Vehicle code').fill(vehicleCode);
  await createVehicle.getByLabel('Assigned driver').selectOption(user.id);
  await createVehicle.getByLabel('Active vehicle', {exact: true}).setChecked(true);
  await createVehicle.getByLabel('Simulated demo (shown publicly)').setChecked(true);
  const vehicleResponse = await save(() => createVehicle.locator('form').getByRole('button', {name: 'Create vehicle', exact: true}).click(), '/api/admin/vehicles', 'POST');
  const {vehicle} = await vehicleResponse.json();
  expect(vehicle.assignedDriver).toBe(user.id);
  expect(vehicle.simulated).toBe(true);
  const vehicleRecord = vehicleSection.locator('.admin-record').filter({hasText: vehicleCode});
  await expect(vehicleRecord).toContainText(driverName);
  await vehicleRecord.locator('summary').filter({hasText: /^Edit vehicle and assignment$/}).click();
  await vehicleRecord.getByLabel('Display name').fill(updatedVehicleName);
  await save(() => vehicleRecord.getByRole('button', {name: 'Save vehicle'}).click(), `/api/admin/vehicles/${vehicle.vehicleId}`, 'PATCH');
  await expect(vehicleRecord.getByRole('heading', {name: `${updatedVehicleName} ${vehicleCode}`, exact: true})).toBeVisible();

  const browserDate = async timestamp => page.evaluate(value => {
    const date = new Date(value);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  }, timestamp);
  const createNotice = noticeSection.locator('details').filter({has: page.locator('summary').filter({hasText: /^Create notice$/})});
  await createNotice.locator('summary').click();
  await createNotice.getByLabel('Title', {exact: true}).fill(noticeTitle);
  await createNotice.getByLabel('Message', {exact: true}).fill('Scheduled browser acceptance demonstration.');
  await createNotice.getByLabel('Severity').selectOption('warning');
  await createNotice.getByLabel('Active from (local time)').fill(await browserDate(Date.now() - 60000));
  await createNotice.getByLabel('Active until (local time)').fill(await browserDate(Date.now() + 7200000));
  const noticeResponse = await save(() => createNotice.locator('form').getByRole('button', {name: 'Create notice', exact: true}).click(), '/api/admin/notices', 'POST');
  const {notice} = await noticeResponse.json();
  const noticeRecord = noticeSection.locator('.admin-record').filter({hasText: noticeTitle});
  await noticeRecord.locator('summary').filter({hasText: /^Edit notice$/}).click();
  await noticeRecord.getByLabel('Title', {exact: true}).fill(updatedNoticeTitle);
  await noticeRecord.getByRole('textbox', {name: 'Message', exact: true}).fill('Updated scheduled browser acceptance demonstration.');
  await noticeRecord.getByLabel('Severity').selectOption('info');
  await save(() => noticeRecord.getByRole('button', {name: 'Save notice'}).click(), `/api/admin/notices/${notice.id}`, 'PATCH');
  await expect(noticeRecord.getByRole('heading', {name: updatedNoticeTitle, exact: true})).toBeVisible();

  const viewer = await page.context().newPage();
  await viewer.goto('/');
  const publicNotices = viewer.getByRole('region', {name: 'Campus service notices'});
  await expect(publicNotices.getByText(updatedNoticeTitle, {exact: true})).toBeVisible();
  await expect(publicNotices).toContainText('Updated scheduled browser acceptance demonstration.');
  await expect(viewer.getByRole('button', {name: 'Sign out'})).not.toBeVisible();

  await page.setViewportSize({width: 1440, height: 1000});
  await page.screenshot({path: path.join(screenshots, 'admin.png'), fullPage: true});
  page.once('dialog', dialog => dialog.accept());
  await save(() => vehicleRecord.getByRole('button', {name: 'Delete vehicle'}).click(), `/api/admin/vehicles/${vehicle.vehicleId}`, 'DELETE');
  await expect(vehicleRecord).toHaveCount(0);
  page.once('dialog', dialog => dialog.accept());
  await save(() => noticeRecord.getByRole('button', {name: 'Delete notice'}).click(), `/api/admin/notices/${notice.id}`, 'DELETE');
  await expect(noticeRecord).toHaveCount(0);
  const refreshedNotices = viewer.waitForResponse(response => response.request().method() === 'GET' && new URL(response.url()).pathname.endsWith('/api/notices'));
  await viewer.reload();
  expect((await (await refreshedNotices).json()).notices.some(item => item.id === notice.id)).toBe(false);
  await expect(viewer.getByRole('heading', {name: 'Find your way'})).toBeVisible();
  await expect(publicNotices.getByText(updatedNoticeTitle, {exact: true})).not.toBeVisible();
  await viewer.close();
  await accountRow.getByLabel(`Role for ${driverName}`).selectOption('student');
  await save(() => accountRow.getByRole('button', {name: 'Update role'}).click(), `/api/admin/users/${user.id}/role`, 'PATCH');
  await expect(accountRow.locator('td').nth(1)).toHaveText('student');
  await page.getByRole('button', {name: 'Sign out'}).click();
  await expect(page.getByRole('link', {name: 'Administration', exact: true})).not.toBeVisible();
});

test('actual driver authorization moves public shuttle marker then becomes stale', async ({page, context, request}) => {
  test.skip(!process.env.DEMO_PASSWORD, 'Private seeded DEMO_PASSWORD required.');
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({latitude: 30.3531, longitude: 76.3645, accuracy: 8});
  await page.goto('/');
  await page.locator('summary').filter({hasText: /^Sign in$/}).click();
  await page.getByLabel('Email', {exact: true}).fill(process.env.DEMO_EMAIL || 'driver@example.test');
  await page.getByLabel('Password', {exact: true}).fill(process.env.DEMO_PASSWORD);
  await page.getByRole('button', {name: 'Sign in', exact: true}).click();
  await page.getByRole('link', {name: 'Driver', exact: true}).click();
  const selected = page.getByLabel('Assigned vehicle');
  await expect(selected).toBeVisible();
  const vehicleId = await selected.inputValue();
  const viewer = await context.newPage();
  await viewer.goto('/');
  await expect(viewer.locator('.connection')).toHaveText('connected');
  await page.getByRole('button', {name: 'Start publishing my location'}).click();
  await expect.poll(async () => {
    const response = await request.get(`http://localhost:8081/api/v1/vehicles/${vehicleId}`);
    return response.ok() ? (await response.json()).lat : null;
  }, {timeout: 15000}).toBe(30.3531);
  const marker = viewer.locator('path[stroke="#167047"]').last();
  await expect(marker).toBeVisible();
  const initialPath = await marker.getAttribute('d');
  await context.setGeolocation({latitude: 30.3535, longitude: 76.3651, accuracy: 8});
  await expect.poll(async () => (await (await request.get(`http://localhost:8081/api/v1/vehicles/${vehicleId}`)).json()).lat, {timeout: 15000}).toBe(30.3535);
  await expect.poll(() => marker.getAttribute('d')).not.toBe(initialPath);
  await viewer.setViewportSize({width: 1440, height: 1000});
  await viewer.locator('.vehicles-panel').scrollIntoViewIfNeeded();
  await viewer.screenshot({path: path.join(screenshots, 'simulated-live-shuttle.png'), fullPage: true});
  await page.getByRole('button', {name: 'Stop publishing'}).click();
  await expect(page.getByText('Browser location watch is stopped.')).toBeVisible();
  const row = viewer.locator('.vehicle-list li').filter({has: viewer.getByText('Campus Shuttle 1', {exact: true})});
  await expect(row.locator('.status')).toHaveText('stale', {timeout: 40000});
  await viewer.close();
});
