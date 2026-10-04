// Run only after deliberately stopping the actual local GraphHopper process.
import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import path from 'node:path';

const routing = process.env.ROUTING_URL || 'http://localhost:5001';
assert.equal((await fetch(routing + '/health')).status, 503, 'Actual routing engine must be unavailable for this scenario');
const browser = await chromium.launch({headless: true, ...(process.env.CHROME_PATH ? {executablePath: process.env.CHROME_PATH} : {})});
try {
  const page = await browser.newPage({viewport: {width: 1440, height: 1000}});
  await page.goto(process.env.FRONTEND_URL || 'http://localhost:5173');
  await page.getByRole('combobox', {name: 'Start at a campus place'}).fill('hostel');
  await page.getByRole('option').first().locator('button').click();
  await page.getByRole('combobox', {name: 'Destination'}).fill('library');
  await page.getByRole('option').first().locator('button').click();
  const failure = page.waitForResponse(response => response.url().endsWith('/api/routes') && response.request().method() === 'POST');
  await page.getByRole('button', {name: 'Calculate walking route'}).click();
  const response = await failure;
  assert.ok([503, 504].includes(response.status()));
  assert.ok(['ROUTING_ENGINE_UNAVAILABLE', 'ROUTING_TIMEOUT'].includes((await response.json()).error.code));
  await page.getByRole('alert').filter({hasText: /routing.*temporarily unavailable/i}).waitFor();
  assert.equal(await page.getByRole('button', {name: 'Calculate walking route'}).isEnabled(), true);
  await page.screenshot({path: path.resolve('../docs/screenshots/routing-unavailable.png'), fullPage: true});
  console.log('Actual GraphHopper outage: safe 503/504, useful browser error and responsive route controls passed.');
} finally {
  await browser.close();
}
