import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import jpeg from 'jpeg-js';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { deviceIds } from '../src/abode/devices.js';
import { AbodeMonitor } from '../src/abode/monitor.js';
import { normalizeConfig } from '../src/config.js';
import { SCENE_ACTIONS } from '../src/scenes.js';
import { FakeAbodeClient } from './fixtures.js';

const manifest = JSON.parse(
  await readFile(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
);
const outputsOf = (key) =>
  manifest.scene_actions.find((entry) => entry.key === key).outputs.map((output) => output.key);

async function setup() {
  const gladys = createFakeGladys();
  const client = new FakeAbodeClient();
  const monitor = new AbodeMonitor({ gladys, createClient: () => client });
  await monitor.start(normalizeConfig({ username: 'me', password: 'pw' }));
  monitor.stop();
  return { gladys, client, monitor };
}

function assertDeclaredOutputs(key, outputs) {
  assert.deepEqual(Object.keys(outputs).sort(), outputsOf(key).sort());
}

test('set_mode arms the alarm and returns the confirmed mode', async () => {
  const { client, monitor } = await setup();
  const outputs = await SCENE_ACTIONS.set_mode(monitor, { fields: { mode: 'away' } });
  monitor.stop();
  assert.deepEqual(outputs, { mode: 'away' });
  assert.deepEqual(client.calls.at(-1), ['setMode', 'away']);
  assertDeclaredOutputs('set_mode', outputs);
});

test('trigger_automation reports an unknown automation through its output', async () => {
  const { monitor } = await setup();
  const found = await SCENE_ACTIONS.trigger_automation(monitor, {
    fields: { automation: 'Good night' },
  });
  monitor.stop();
  assert.deepEqual(found, { triggered: true, automation_name: 'Good night' });
  assertDeclaredOutputs('trigger_automation', found);
  const missing = await SCENE_ACTIONS.trigger_automation(monitor, {
    fields: { automation: 'Nope' },
  });
  assert.deepEqual(missing, { triggered: false, automation_name: '' });
});

test('capture_image publishes a camera image', async () => {
  const { gladys, client, monitor } = await setup();
  client.image = Buffer.from(
    jpeg.encode({ width: 8, height: 8, data: Buffer.alloc(8 * 8 * 4, 128) }, 80).data,
  );
  const camera = client.devices.find((d) => d.name === 'Garden camera');
  const outputs = await SCENE_ACTIONS.capture_image(monitor, {
    fields: { camera: deviceIds(gladys, camera).device },
  });
  assert.deepEqual(outputs, { captured: true });
  assertDeclaredOutputs('capture_image', outputs);
  const notACamera = await SCENE_ACTIONS.capture_image(monitor, {
    fields: { camera: deviceIds(gladys, client.devices[0]).device },
  });
  assert.deepEqual(notACamera, { captured: false });
});
