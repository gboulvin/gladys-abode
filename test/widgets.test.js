import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { AbodeMonitor } from '../src/abode/monitor.js';
import { normalizeConfig } from '../src/config.js';
import { WIDGETS, WIDGET_KEYS, refreshChangedWidgets, refreshWidgets } from '../src/widgets.js';
import { FakeAbodeClient } from './fixtures.js';

async function setup() {
  const gladys = createFakeGladys();
  const client = new FakeAbodeClient();
  const monitor = new AbodeMonitor({ gladys, createClient: () => client });
  await monitor.start(normalizeConfig({ username: 'me', password: 'pw' }));
  monitor.stop();
  return { gladys, client, monitor };
}

const request = (settings = {}) => ({ settings, language: 'en', units: 'metric' });

test('every widget content is rendered exactly as sent, connected or not', async () => {
  const { monitor } = await setup();
  const offline = new AbodeMonitor({ gladys: createFakeGladys() });
  for (const [key, widget] of Object.entries(WIDGETS)) {
    for (const m of [monitor, offline]) {
      for (const settings of [{}, { allow_disarm: true }]) {
        const content = await widget.get(m, request(settings));
        assert.deepEqual(validateWidgetContent(content), [], `${key}`);
      }
    }
  }
});

test('the disarm button only shows when the widget instance allows it', async () => {
  const { monitor } = await setup();
  const widget = WIDGETS[WIDGET_KEYS.ALARM];
  const modes = async (settings) =>
    (await widget.get(monitor, request(settings))).components
      .filter((c) => c.type === 'button')
      .map((c) => c.action.key);
  assert.deepEqual(await modes({}), ['arm_away', 'arm_home']);
  assert.deepEqual(await modes({ allow_disarm: true }), ['arm_away', 'arm_home', 'disarm']);
  const buttons = (await widget.get(monitor, request())).components.filter(
    (c) => c.type === 'button',
  );
  assert.ok(buttons.every((button) => button.action.confirm === true));
});

test('the alarm buttons set the mode, disarming only when allowed', async () => {
  const { client, monitor } = await setup();
  const widget = WIDGETS[WIDGET_KEYS.ALARM];
  const toast = await widget.action(monitor, {
    actionKey: 'arm_away',
    params: {},
    settings: {},
  });
  monitor.stop();
  assert.equal(toast.en, 'Alarm mode set to: Away.');
  assert.ok(toast.en.length <= 200);
  const refused = await widget.action(monitor, {
    actionKey: 'disarm',
    params: {},
    settings: {},
  });
  assert.match(refused.en, /disabled/);
  assert.deepEqual(
    client.calls.filter(([call]) => call === 'setMode'),
    [['setMode', 'away']],
  );
  await assert.rejects(
    widget.action(monitor, { actionKey: 'nope', params: {}, settings: {} }),
    /Unknown widget action/,
  );
});

test('the openings widget lists the open sensors first', async () => {
  const { client, monitor } = await setup();
  client.devices.find((d) => d.name === 'Garage').status = 'Open';
  await monitor.refresh();
  monitor.stop();
  const content = await WIDGETS[WIDGET_KEYS.OPENINGS].get(monitor, request());
  const [status] = content.components;
  assert.equal(status.items[0].label, 'Garage');
  assert.equal(status.items[0].value.en, 'Open');
});

test('the timeline widget lists the recent events', async () => {
  const { monitor } = await setup();
  const content = await WIDGETS[WIDGET_KEYS.TIMELINE].get(monitor, request());
  const [list] = content.components;
  assert.equal(list.type, 'card-list');
  assert.equal(list.items[0].title, 'Front door opened');
  assert.ok(list.items[0].date.startsWith('2025-'));
});

test('widget refreshes', () => {
  const gladys = createFakeGladys();
  refreshWidgets(gladys);
  assert.deepEqual(gladys.fake.widgetRefreshes, Object.keys(WIDGETS));
  const other = createFakeGladys();
  refreshChangedWidgets(other, ['mode', 'faults']);
  assert.deepEqual(other.fake.widgetRefreshes, [WIDGET_KEYS.ALARM]);
});
