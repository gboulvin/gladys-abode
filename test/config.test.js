import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_CONFIG,
  MAX_REFRESH_INTERVAL,
  MIN_REFRESH_INTERVAL,
  isConfigured,
  normalizeConfig,
} from '../src/config.js';

test('normalizeConfig returns the defaults when called with no argument', () => {
  assert.deepEqual(normalizeConfig(), DEFAULT_CONFIG);
  assert.equal(isConfigured(normalizeConfig()), false);
});

test('normalizeConfig trims the email and keeps the password as typed', () => {
  const config = normalizeConfig({ username: ' me@example.com ', password: ' secret ' });
  assert.equal(config.username, 'me@example.com');
  assert.equal(config.password, ' secret ');
  assert.equal(isConfigured(config), true);
});

test('normalizeConfig coerces and bounds the refresh interval', () => {
  assert.equal(normalizeConfig({ refresh_interval: '30' }).refresh_interval, 30);
  assert.equal(normalizeConfig({ refresh_interval: 1 }).refresh_interval, MIN_REFRESH_INTERVAL);
  assert.equal(normalizeConfig({ refresh_interval: 9999 }).refresh_interval, MAX_REFRESH_INTERVAL);
  assert.equal(
    normalizeConfig({ refresh_interval: 'abc' }).refresh_interval,
    DEFAULT_CONFIG.refresh_interval,
  );
});
