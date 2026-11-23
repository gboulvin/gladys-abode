// -----------------------------------------------------------------------------
// Entry point of the Abode integration for Gladys Assistant.
//
// This file only wires the SDK to the Abode monitor (src/abode/monitor.js),
// which holds the connection to the Abode cloud, the device mapping and the
// scene triggers. Handlers are registered BEFORE connect().
//
// Environment variables provided by the Gladys supervisor to the container
// (read by the SDK): GLADYS_HOST_API_URL, GLADYS_INTEGRATION_TOKEN,
// GLADYS_INTEGRATION_SELECTOR.
// -----------------------------------------------------------------------------

import { GladysIntegration, logger } from '@gladysassistant/integration-sdk';
import { normalizeConfig } from './src/config.js';
import { AbodeClient } from './src/abode/client.js';
import { AbodeMonitor } from './src/abode/monitor.js';
import { loadClientUuid } from './src/abode/storage.js';
import { ACTIONS } from './src/actions.js';
import { SCENE_ACTIONS } from './src/scenes.js';
import { WIDGETS, refreshChangedWidgets, refreshWidgets } from './src/widgets.js';

const gladys = new GladysIntegration();

const monitor = new AbodeMonitor({
  gladys,
  createClient: async (config) =>
    new AbodeClient({
      username: config.username,
      password: config.password,
      uuid: await loadClientUuid(),
    }),
  onWidgetsChanged: (changes) => refreshChangedWidgets(gladys, changes),
});

// Apply a configuration: new Abode session, devices published on first read.
async function applyConfig(rawConfig) {
  await monitor.start(normalizeConfig(rawConfig));
  refreshWidgets(gladys);
}

// --- Discovery: Gladys asks for the device list -------------------------------
gladys.onScanRequest(async () => {
  logger.info('onScanRequest -> reading Abode');
  await monitor.refresh();
  await gladys.publishDiscoveredDevices(monitor.discoveredDevices());
});

// --- Commands: alarm mode, switches, lights, locks, valves, garage doors ------
gladys.onSetValue(async (device, feature, value) => {
  logger.info(`onSetValue <- ${feature.external_id}`);
  await monitor.setValue(feature.external_id, value);
});

// --- Cameras: fresh snapshot ---------------------------------------------------
gladys.onGetImage(async (device) => {
  logger.info(`onGetImage <- ${device.external_id}`);
  return monitor.getImage(device.external_id);
});

// --- Configuration screen buttons (manifest `actions`) -------------------------
for (const [key, handler] of Object.entries(ACTIONS)) {
  gladys.onAction(key, (fields) => handler(monitor, fields));
}

// --- Scene actions (manifest `scene_actions`) ----------------------------------
for (const [key, handler] of Object.entries(SCENE_ACTIONS)) {
  gladys.onSceneAction(key, (fields) => handler(monitor, { fields }));
}

// --- Dashboard widgets (manifest `widgets`) ------------------------------------
for (const [key, widget] of Object.entries(WIDGETS)) {
  gladys.onWidgetGet(key, (request) => widget.get(monitor, request));
  if (typeof widget.action === 'function') {
    gladys.onWidgetAction(key, (actionKey, params, { settings }) =>
      widget.action(monitor, { actionKey, params, settings }),
    );
  }
}

// --- Configuration updated by the user -----------------------------------------
gladys.onConfigUpdated(async (newConfig) => {
  logger.info('onConfigUpdated -> reconnecting to Abode');
  await applyConfig(newConfig);
});

// --- Connection lifecycle --------------------------------------------------------
gladys.on('connected', async () => {
  try {
    await applyConfig(await gladys.getConfig());
  } catch (err) {
    logger.error('Post-connection initialization failed', err);
    await gladys.setConnectionStatus(false).catch(() => {});
  }
});

gladys.on('disconnected', () => {
  monitor.stop();
});

gladys.handleShutdown(async (signal) => {
  logger.info(`Received ${signal} -> graceful shutdown`);
  await monitor.shutdown();
});

logger.info('Starting the Abode integration...');
gladys.connect().catch((err) => {
  logger.error('Initial connection failed', err);
  process.exit(1);
});
