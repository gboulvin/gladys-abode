import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { AbodeApiError, AbodeAuthError } from '../src/abode/client.js';
import { FEATURE, deviceIds, panelIds } from '../src/abode/devices.js';
import { alarmType } from '../src/abode/events.js';
import { AbodeMonitor, SCENE_TRIGGERS } from '../src/abode/monitor.js';
import { normalizeConfig } from '../src/config.js';
import { FakeAbodeClient } from './fixtures.js';

const manifest = JSON.parse(
  await readFile(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
);
const config = normalizeConfig({ username: 'me@example.com', password: 'pw' });

async function startedMonitor() {
  const gladys = createFakeGladys();
  const client = new FakeAbodeClient();
  const widgetChanges = [];
  const monitor = new AbodeMonitor({
    gladys,
    createClient: () => client,
    onWidgetsChanged: (changes) => widgetChanges.push(...changes),
  });
  await monitor.start(config);
  monitor.stop(); // the tests drive refresh() themselves
  return { gladys, client, monitor, widgetChanges };
}

const declaredKeys = (key) => {
  const trigger = manifest.scene_triggers.find((entry) => entry.key === key);
  return [...trigger.fields, ...trigger.variables].map((field) => field.key);
};

function assertEventsDeclared(gladys) {
  for (const { key, data } of gladys.fake.sceneEvents) {
    for (const [name, value] of Object.entries(data)) {
      assert.ok(declaredKeys(key).includes(name), `${key}.${name} is not declared`);
      assert.ok(value === null || typeof value !== 'object', `${key}.${name} is a primitive`);
    }
  }
}

test('the first read publishes the devices, the states and the connection, no event', async () => {
  const { gladys, monitor } = await startedMonitor();
  assert.ok(gladys.fake.discoveredDevices.length > 1);
  assert.ok(gladys.fake.states.length > 0);
  assert.equal(gladys.fake.connectionStatus.connected, true);
  assert.equal(gladys.fake.sceneEvents.length, 0, 'the first read only sets the baseline');
  assert.ok(gladys.fake.transports.every((entry) => entry.transport === 'cloud'));
  assert.equal(monitor.mode, 'standby');
});

test('a missing configuration reports it instead of signing in', async () => {
  const gladys = createFakeGladys();
  const monitor = new AbodeMonitor({ gladys, createClient: () => assert.fail('no client') });
  await monitor.start(normalizeConfig());
  assert.equal(gladys.fake.connectionStatus.connected, false);
  assert.match(gladys.fake.connectionStatus.message.en, /email and password/);
});

test('a mode change fires mode_changed once', async () => {
  const { gladys, client, monitor, widgetChanges } = await startedMonitor();
  client.panel.mode.area_1 = 'away';
  await monitor.refresh();
  await monitor.refresh();
  const events = gladys.fake.sceneEvents.filter((e) => e.key === SCENE_TRIGGERS.MODE_CHANGED);
  assert.equal(events.length, 1);
  assert.equal(events[0].data.mode, 'away');
  assert.equal(events[0].data.previous_mode, 'standby');
  assert.ok(widgetChanges.includes('mode'));
  assert.equal(gladys.fake.lastState(panelIds(gladys, client.panel).feature(FEATURE.MODE)), 'away');
  assertEventsDeclared(gladys);
});

test('a new alarm of the timeline fires alarm_triggered once', async () => {
  const { gladys, client, monitor } = await startedMonitor();
  client.timeline.unshift({
    id: '1003',
    event_utc: '1764000200',
    event_code: '1131',
    event_type: 'Alarm',
    event_name: 'Burglar alarm: Front door',
    device_id: 'RF:00000001',
    device_name: 'Front door',
  });
  await monitor.refresh();
  await monitor.refresh();
  const events = gladys.fake.sceneEvents.filter((e) => e.key === SCENE_TRIGGERS.ALARM_TRIGGERED);
  assert.equal(events.length, 1);
  assert.equal(events[0].data.alarm_type, 'burglary');
  assert.equal(events[0].data.device, deviceIds(gladys, client.devices[0]).device);
  assert.equal(monitor.lastAlarm.id, '1003');
  assertEventsDeclared(gladys);
});

test('a fault that appears fires device_fault once', async () => {
  const { gladys, client, monitor } = await startedMonitor();
  client.devices[0].faults.low_battery = 1;
  await monitor.refresh();
  await monitor.refresh();
  const events = gladys.fake.sceneEvents.filter((e) => e.key === SCENE_TRIGGERS.DEVICE_FAULT);
  assert.equal(events.length, 1);
  assert.equal(events[0].data.fault, 'low_battery');
  assert.equal(events[0].data.device_name, 'Front door');
  assertEventsDeclared(gladys);
});

test('a new device in Abode is published again', async () => {
  const { gladys, client, monitor } = await startedMonitor();
  const before = gladys.fake.discoveredDevices.length;
  client.devices.push({
    id: 'RF:000000AA',
    type_tag: 'device_type.door_contact',
    name: 'Kitchen window',
    status: 'Open',
  });
  await monitor.refresh();
  assert.equal(gladys.fake.discoveredDevices.length, before + 1);
});

test('an unreachable cloud marks the devices unreachable, then recovers', async () => {
  const { gladys, client, monitor } = await startedMonitor();
  client.failWith = new AbodeApiError('Abode cloud unreachable: timeout', 0);
  assert.equal(await monitor.refresh(), false);
  assert.equal(gladys.fake.connectionStatus.connected, false);
  assert.ok(gladys.fake.transports.some((entry) => entry.transport === 'unreachable'));
  client.failWith = null;
  assert.equal(await monitor.refresh(), true);
  assert.equal(gladys.fake.connectionStatus.connected, true);
});

test('refused credentials are reported with their own message', async () => {
  const { gladys, client, monitor } = await startedMonitor();
  client.failWith = new AbodeAuthError('Invalid', { mfa: true });
  await monitor.refresh();
  assert.match(gladys.fake.connectionStatus.message.en, /two-factor/);
});

test('commands reach Abode and publish the new state', async () => {
  const { gladys, client, monitor } = await startedMonitor();
  const light = client.devices.find((d) => d.name === 'Living room light');
  const brightness = deviceIds(gladys, light).feature(FEATURE.BRIGHTNESS);
  await monitor.setValue(brightness, 35);
  assert.deepEqual(client.calls.at(-1), ['setLevel', light.id, 35]);
  assert.equal(gladys.fake.lastState(brightness), 35);

  const mode = panelIds(gladys, client.panel).feature(FEATURE.MODE);
  await monitor.setValue(mode, 'home');
  assert.deepEqual(client.calls.at(-1), ['setMode', 'home']);
  assert.equal(gladys.fake.lastState(mode), 'home');
  monitor.stop();

  await assert.rejects(monitor.setValue('ext:nope:feature', 1), /Unknown Abode feature/);
  await assert.rejects(monitor.setMode('party'), /Unknown alarm mode/);
});

test('automations run by name or id, case-insensitive', async () => {
  const { client, monitor } = await startedMonitor();
  assert.equal((await monitor.triggerAutomation('good NIGHT')).id, '11');
  assert.equal((await monitor.triggerAutomation('12')).name, 'Lights off');
  assert.equal(await monitor.triggerAutomation('unknown'), null);
  monitor.stop();
  assert.deepEqual(
    client.calls.filter(([call]) => call === 'applyAutomation'),
    [
      ['applyAutomation', '11'],
      ['applyAutomation', '12'],
    ],
  );
});

test('alarm types follow the Contact ID codes', () => {
  assert.equal(alarmType({ event_code: '1110' }), 'fire');
  assert.equal(alarmType({ event_code: '1120' }), 'panic');
  assert.equal(alarmType({ event_code: '1100' }), 'medical');
  assert.equal(alarmType({ event_code: '1154' }), 'water');
  assert.equal(alarmType({ event_code: '1162' }), 'co');
  assert.equal(alarmType({ event_code: '3131' }), null, 'a restore is not an alarm');
  assert.equal(alarmType({ event_code: '1401' }), null, 'arming is not an alarm');
  assert.equal(alarmType({ event_type: 'Alarm', event_name: 'Smoke alarm' }), 'fire');
  assert.equal(alarmType({ event_type: 'Alarm', event_name: 'Alarm canceled' }), null);
});

test('every alarm type and fault the code fires is a filter option of its trigger', async () => {
  const { ALARM_TYPES } = await import('../src/abode/events.js');
  const { FAULT_TYPES } = await import('../src/abode/monitor.js');
  const options = (trigger, field) =>
    manifest.scene_triggers
      .find((entry) => entry.key === trigger)
      .fields.find((entry) => entry.key === field)
      .options.map((option) => option.value);
  assert.deepEqual(options('alarm_triggered', 'alarm_type').sort(), [...ALARM_TYPES].sort());
  assert.deepEqual(options('device_fault', 'fault').sort(), [...FAULT_TYPES].sort());
});
