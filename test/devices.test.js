import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEVICE_FEATURE_CATEGORIES } from '@gladysassistant/integration-sdk';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import {
  FEATURE,
  activeFaults,
  buildDiscoveredDevices,
  buildStates,
  detectKind,
  deviceCommand,
  deviceIds,
  discoverySignature,
  featureKeys,
  openings,
  panelIds,
  panelMode,
  parseNumber,
  platformId,
  resolveFeature,
} from '../src/abode/devices.js';
import { devicesFixture, panelFixture } from './fixtures.js';

const gladys = createFakeGladys();
const panel = panelFixture('home');
const devices = devicesFixture();
const byName = (name) => devices.find((device) => device.name === name);
const stateOf = (states, id) => states.find((s) => s.device_feature_external_id === id);

test('Gladys accepts the discovery payload', async () => {
  // The SDK fake checks it like the host API: prefix, categories, types,
  // units, and the NOT NULL columns of every feature.
  const fresh = createFakeGladys();
  const list = buildDiscoveredDevices(fresh, panel, devices);
  await fresh.publishDiscoveredDevices(list);
  assert.equal(fresh.fake.discoveredDevices.length, list.length);
});

test('every feature carries the columns Gladys needs to create it', () => {
  for (const device of buildDiscoveredDevices(gladys, panel, devices)) {
    assert.ok(device.features.length > 0, `${device.name} has features`);
    for (const feature of device.features) {
      const where = `${device.name} / ${feature.name}`;
      assert.ok(typeof feature.name === 'string' && feature.name.length > 0, `${where}: name`);
      assert.ok(Number.isFinite(feature.min) && Number.isFinite(feature.max), `${where}: range`);
      assert.ok(feature.min <= feature.max, `${where}: min <= max`);
      assert.equal(typeof feature.read_only, 'boolean', `${where}: read_only`);
      assert.equal(typeof feature.has_feedback, 'boolean', `${where}: has_feedback`);
    }
  }
});

test('the integration polls Abode itself: no device asks Gladys for polling', () => {
  for (const device of buildDiscoveredDevices(gladys, panel, devices)) {
    assert.equal(device.should_poll, false);
    assert.equal(device.poll_frequency, undefined);
  }
});

test('external ids derive from the Abode ids and are unique', () => {
  assert.equal(platformId('ZB:00A1b2c3'), 'zb-00a1b2c3');
  const list = buildDiscoveredDevices(gladys, panel, devices);
  const ids = list.map((device) => device.external_id);
  assert.equal(new Set(ids).size, ids.length);
  const features = list.flatMap((device) => device.features.map((f) => f.external_id));
  assert.equal(new Set(features).size, features.length);
  assert.equal(list[0].external_id, panelIds(gladys, panel).device);
});

test('a device without any usable feature is not published', () => {
  const list = buildDiscoveredDevices(gladys, panel, devices);
  assert.ok(!list.some((device) => device.name === 'Keypad'));
});

test('device kinds follow the Abode type tags', () => {
  assert.equal(detectKind(byName('Front door')), 'opening');
  assert.equal(detectKind(byName('Hallway motion')), 'motion');
  assert.equal(detectKind(byName('Back door lock')), 'lock');
  assert.equal(detectKind(byName('Living room light')), 'light');
  assert.equal(detectKind(byName('Coffee machine')), 'switch');
  assert.equal(detectKind(byName('Bedroom sensor')), 'sensor');
  assert.equal(detectKind(byName('Laundry leak')), 'water');
  assert.equal(detectKind(byName('Garden camera')), 'camera');
  assert.equal(detectKind(byName('Garage')), 'cover');
  assert.equal(detectKind({ type_tag: 'device_type.new_smart_plug' }), 'switch');
  assert.equal(detectKind({ type_tag: 'device_type.something' }), 'other');
});

test('the multi-sensor publishes the measures it reports, with their units', () => {
  const keys = featureKeys(byName('Bedroom sensor'));
  assert.deepEqual(keys, [FEATURE.TEMPERATURE, FEATURE.HUMIDITY, FEATURE.LUX, FEATURE.BATTERY_LOW]);
  const states = buildStates(gladys, panel, devices);
  const ids = deviceIds(gladys, byName('Bedroom sensor'));
  assert.equal(stateOf(states, ids.feature(FEATURE.TEMPERATURE)).state, 21.5);
  assert.equal(stateOf(states, ids.feature(FEATURE.HUMIDITY)).state, 48);
  assert.equal(stateOf(states, ids.feature(FEATURE.LUX)).state, 120);
  const fahrenheit = { ...byName('Bedroom sensor'), statuses: { temperature: '70 °F' } };
  const [device] = buildDiscoveredDevices(gladys, null, [fahrenheit]);
  assert.equal(device.features[0].unit, 'fahrenheit');
});

test('the panel exposes the alarm mode as a select', () => {
  const [device] = buildDiscoveredDevices(gladys, panel, []);
  const [mode] = device.features;
  assert.equal(mode.category, DEVICE_FEATURE_CATEGORIES.TEXT);
  assert.deepEqual(
    mode.supported_options.map((option) => option.value),
    ['standby', 'home', 'away'],
  );
  const states = buildStates(gladys, panel, []);
  assert.deepEqual(states, [{ device_feature_external_id: mode.external_id, text: 'home' }]);
  assert.equal(panelMode({ mode: { area_1: 'bogus' } }), null);
});

test('states read the Abode statuses', () => {
  const states = buildStates(gladys, panel, devices);
  const value = (name, key) => stateOf(states, deviceIds(gladys, byName(name)).feature(key))?.state;
  assert.equal(value('Front door', FEATURE.OPENING), 1, 'a closed contact reads 1');
  assert.equal(value('Back door lock', FEATURE.LOCK), 1, 'locked');
  assert.equal(value('Living room light', FEATURE.LIGHT), 1);
  assert.equal(value('Living room light', FEATURE.BRIGHTNESS), 60);
  assert.equal(value('Coffee machine', FEATURE.SWITCH), 0);
  assert.equal(value('Laundry leak', FEATURE.LEAK), 0);
  assert.equal(value('Hallway motion', FEATURE.MOTION), 0);
  assert.equal(value('Garage', FEATURE.COVER), undefined, 'a command feature has no state');

  const opened = buildStates(gladys, null, [{ ...byName('Front door'), status: 'Open' }]);
  assert.equal(opened[0].state, 0, 'an open contact reads 0');
  const wet = buildStates(gladys, null, [{ ...byName('Laundry leak'), status: 'Wet' }]);
  assert.equal(wet[0].state, 1);
});

test('Gladys accepts the states', async () => {
  const fresh = createFakeGladys();
  await fresh.publishStates(buildStates(fresh, panel, devices));
  assert.ok(fresh.fake.states.length > 0);
});

test('commands map to the Abode calls', () => {
  assert.deepEqual(deviceCommand(FEATURE.SWITCH, 1), { call: 'status', value: 1 });
  assert.deepEqual(deviceCommand(FEATURE.LOCK, 0), { call: 'status', value: 0 });
  assert.deepEqual(deviceCommand(FEATURE.BRIGHTNESS, 140), { call: 'level', value: 100 });
  assert.deepEqual(deviceCommand(FEATURE.COVER, -1), { call: 'status', value: 0 });
  assert.throws(() => deviceCommand(FEATURE.COVER, 0), /stopped/);
  assert.throws(() => deviceCommand(FEATURE.OPENING, 1), /cannot be controlled/);
});

test('resolveFeature finds the panel and the devices behind a feature', () => {
  const mode = panelIds(gladys, panel).feature(FEATURE.MODE);
  assert.deepEqual(resolveFeature(gladys, panel, devices, mode), {
    target: 'panel',
    key: FEATURE.MODE,
  });
  const light = deviceIds(gladys, byName('Living room light')).feature(FEATURE.BRIGHTNESS);
  const found = resolveFeature(gladys, panel, devices, light);
  assert.equal(found.device.name, 'Living room light');
  assert.equal(found.key, FEATURE.BRIGHTNESS);
  assert.equal(resolveFeature(gladys, panel, devices, 'ext:nope:x'), null);
});

test('the discovery signature changes when the Abode system changes', () => {
  const before = discoverySignature(panel, devices);
  assert.equal(discoverySignature(panel, devicesFixture()), before, 'stable for the same system');
  const renamed = devicesFixture();
  renamed[0].name = 'Main door';
  assert.notEqual(discoverySignature(panel, renamed), before);
  const statusOnly = devicesFixture();
  statusOnly[0].status = 'Open';
  assert.equal(discoverySignature(panel, statusOnly), before, 'a state change is not a new device');
});

test('openings and faults', () => {
  assert.deepEqual(
    openings(devices).map(({ device, open }) => [device.name, open]),
    [
      ['Front door', false],
      ['Garage', false],
    ],
  );
  assert.deepEqual(activeFaults({ faults: { low_battery: 1, tempered: '1' } }), [
    'low_battery',
    'tamper',
  ]);
  assert.deepEqual(activeFaults({ status: 'Offline' }), ['offline']);
  assert.deepEqual(activeFaults(byName('Front door')), []);
});

test('parseNumber reads Abode status strings', () => {
  assert.equal(parseNumber('21.5 °C'), 21.5);
  assert.equal(parseNumber('-3,5'), -3.5);
  assert.equal(parseNumber(12), 12);
  assert.equal(parseNumber('n/a'), null);
});
