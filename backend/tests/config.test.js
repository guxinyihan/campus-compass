import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadConfig} from '../src/config.js';
test('startup rejects missing, shared secrets and wildcard CORS', () => {
  assert.throws(() => loadConfig({}));
  assert.throws(() => loadConfig({JWT_SECRET: 'x'.repeat(32), TRACKING_JWT_SECRET: 'x'.repeat(32)}));
  assert.throws(() => loadConfig({JWT_SECRET: 'x'.repeat(32), TRACKING_JWT_SECRET: 'y'.repeat(32), CORS_ORIGINS: '*'}));
});
