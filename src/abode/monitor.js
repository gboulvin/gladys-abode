// -----------------------------------------------------------------------------
// Abode monitor: the live link between the Abode cloud and Gladys.
//
// Every `refresh_interval` seconds it reads the panel, the devices and the
// recent timeline, then:
//   - publishes the devices again when the Abode system changed (a device
//     added, renamed...), with their `cloud` transport badge;
//   - publishes the states that changed (publishChangedStates: the host API
//     accepts 300 states a minute, sized for changes, not snapshots);
//   - fires the scene triggers on transitions only — one event per change of
//     mode, per new alarm of the timeline, per fault that appears — never on
//     the first read, which only sets the baseline;
//   - nudges the dashboard widgets when what they show changed.
//
// It also runs the commands (alarm mode, switches, lights, locks...), the
// automations and the camera snapshots for index.js, the scene actions and
// the widgets. Abode only has a cloud API, so every device is `cloud`.
// -----------------------------------------------------------------------------

import { createLogger, DEVICE_TRANSPORTS } from '@gladysassistant/integration-sdk';
import { isConfigured } from '../config.js';
import { t } from '../i18n.js';
import { AbodeAuthError, AbodeClient, ABODE_MODES } from './client.js';
import {
  activeFaults,
  buildDiscoveredDevices,
  buildStates,
  deviceCommand,
  deviceIds,
  discoverySignature,
  detectKind,
  FEATURE,
  openings,
  panelIds,
  panelMode,
  resolveFeature,
} from './devices.js';
import { alarmType, eventDate, eventId } from './events.js';
import { toCameraImage } from './image.js';

const logger = createLogger({ name: 'monitor' });

export const SCENE_TRIGGERS = {
  MODE_CHANGED: 'mode_changed',
  ALARM_TRIGGERED: 'alarm_triggered',
  DEVICE_FAULT: 'device_fault',
};

// Faults that fire the `device_fault` trigger (keys of its `fault` filter).
export const FAULT_TYPES = ['low_battery', 'tamper', 'offline', 'jammed'];

const STATE_HEARTBEAT_MS = 30 * 60 * 1000;
const TIMELINE_SIZE = 20;
const MAX_SEEN_EVENTS = 500;
const MAX_TRANSPORTS_PER_REQUEST = 100;
// After refused credentials, wait before trying again: repeated failed
// sign-ins can lock the Abode account.
const AUTH_RETRY_DELAY_MS = 30 * 60 * 1000;
// A command is followed by a read, to publish what Abode confirms.
const AFTER_COMMAND_REFRESH_MS = 2_000;

export class AbodeMonitor {
  /**
   * @param {object} options
   * @param {object} options.gladys - GladysIntegration.
   * @param {(config: object) => Promise<object>|object} [options.createClient]
   * @param {(keys: string[]) => void} [options.onWidgetsChanged]
   */
  constructor({ gladys, createClient, onWidgetsChanged = () => {} }) {
    this.gladys = gladys;
    this.createClient = createClient ?? ((config) => new AbodeClient(config));
    this.onWidgetsChanged = onWidgetsChanged;
    this.client = null;
    this.config = null;
    this.timer = null;
    this.generation = 0;
    this.refreshing = null;
    this.reset();
  }

  reset() {
    this.panel = null;
    this.devices = [];
    this.timeline = [];
    this.signature = null;
    this.connected = false;
    this.lastError = null;
    this.seenEvents = new Set();
    this.faults = new Map();
    this.lastAlarm = null;
  }

  get mode() {
    return panelMode(this.panel);
  }

  // --- Lifecycle -----------------------------------------------------------------

  /** (Re)start with a configuration: new session, new baseline. */
  async start(config) {
    this.stop();
    const generation = ++this.generation;
    if (this.client) {
      await this.client.logout();
    }
    this.client = null;
    this.reset();
    this.config = config;
    if (!isConfigured(config)) {
      logger.info('No Abode credentials yet: waiting for the configuration');
      await this.gladys.setConnectionStatus(false, t('status_not_configured'));
      return;
    }
    this.client = await this.createClient(config);
    if (generation !== this.generation) {
      return;
    }
    await this.refresh();
    this.schedule();
  }

  stop() {
    this.generation += 1;
    clearTimeout(this.timer);
    this.timer = null;
  }

  async shutdown() {
    this.stop();
    await this.client?.logout();
  }

  schedule(delayMs) {
    clearTimeout(this.timer);
    const generation = this.generation;
    const delay =
      delayMs ??
      (this.lastError instanceof AbodeAuthError
        ? AUTH_RETRY_DELAY_MS
        : this.config.refresh_interval * 1000);
    this.timer = setTimeout(async () => {
      if (generation !== this.generation) {
        return;
      }
      await this.refresh();
      if (generation === this.generation) {
        this.schedule();
      }
    }, delay);
    this.timer.unref?.();
  }

  // --- Refresh -------------------------------------------------------------------

  /** Read Abode and publish to Gladys; concurrent calls share one read. */
  refresh() {
    if (!this.refreshing) {
      this.refreshing = this._refresh().finally(() => {
        this.refreshing = null;
      });
    }
    return this.refreshing;
  }

  async _refresh() {
    if (!this.client) {
      return false;
    }
    const changedWidgets = new Set();
    try {
      const [panel, devices] = await Promise.all([
        this.client.getPanel(),
        this.client.getDevices(),
      ]);
      let timeline = this.timeline;
      try {
        timeline = await this.client.getTimeline(TIMELINE_SIZE);
      } catch (err) {
        // The timeline only feeds the alarm trigger and a widget: a failed
        // read must not hide the devices.
        logger.warn(`Timeline read failed: ${err.message}`);
      }

      const firstRead = this.panel === null;
      const previousMode = this.mode;
      const previousOpenings = openingsKey(this.devices);

      this.panel = panel;
      this.devices = devices;
      if (!firstRead) {
        await this.fireModeChange(previousMode, changedWidgets);
        await this.fireFaults(changedWidgets);
        await this.fireAlarms(timeline, changedWidgets);
      } else {
        this.rememberBaseline(timeline);
      }
      if (timelineKey(timeline) !== timelineKey(this.timeline)) {
        changedWidgets.add('timeline');
      }
      this.timeline = timeline;
      if (openingsKey(devices) !== previousOpenings) {
        changedWidgets.add('openings');
      }

      const signature = discoverySignature(panel, devices);
      if (signature !== this.signature) {
        logger.info(`Publishing ${devices.length} Abode device(s) and the panel`);
        await this.gladys.publishDiscoveredDevices(this.discoveredDevices());
        this.signature = signature;
        await this.publishTransports(DEVICE_TRANSPORTS.CLOUD);
      }
      await this.gladys.publishChangedStates(buildStates(this.gladys, panel, devices), {
        heartbeat: STATE_HEARTBEAT_MS,
      });

      if (!this.connected) {
        this.connected = true;
        this.lastError = null;
        await this.publishTransports(DEVICE_TRANSPORTS.CLOUD);
        await this.gladys.setConnectionStatus(true);
        changedWidgets.add('connection');
      }
      return true;
    } catch (err) {
      await this.handleError(err, changedWidgets);
      return false;
    } finally {
      if (changedWidgets.size > 0) {
        this.onWidgetsChanged([...changedWidgets]);
      }
    }
  }

  async handleError(err, changedWidgets) {
    const wasConnected = this.connected;
    this.connected = false;
    this.lastError = err;
    if (err instanceof AbodeAuthError) {
      logger.error(`Abode sign-in refused: ${err.message}`);
      await this.safely(() =>
        this.gladys.setConnectionStatus(
          false,
          t(err.mfa ? 'status_mfa_required' : 'status_auth_failed'),
        ),
      );
    } else {
      logger.error(`Abode refresh failed: ${err.message}`);
      await this.safely(() => this.gladys.setConnectionStatus(false, t('status_unreachable')));
    }
    if (wasConnected || this.signature) {
      await this.safely(() => this.publishTransports(DEVICE_TRANSPORTS.UNREACHABLE));
    }
    changedWidgets.add('connection');
  }

  async safely(fn) {
    try {
      await fn();
    } catch (err) {
      logger.warn(`Gladys call failed: ${err.message}`);
    }
  }

  discoveredDevices() {
    return buildDiscoveredDevices(this.gladys, this.panel, this.devices);
  }

  async publishTransports(transport) {
    const entries = this.discoveredDevices().map((device) => ({
      external_id: device.external_id,
      transport,
    }));
    for (let start = 0; start < entries.length; start += MAX_TRANSPORTS_PER_REQUEST) {
      await this.gladys.publishTransports(entries.slice(start, start + MAX_TRANSPORTS_PER_REQUEST));
    }
  }

  // --- Scene triggers ------------------------------------------------------------

  async fireModeChange(previousMode, changedWidgets) {
    const mode = this.mode;
    if (!mode || !previousMode || mode === previousMode) {
      return;
    }
    logger.info(`Alarm mode changed: ${previousMode} -> ${mode}`);
    changedWidgets.add('mode');
    await this.publishEvent(SCENE_TRIGGERS.MODE_CHANGED, {
      mode,
      previous_mode: previousMode,
    });
  }

  async fireFaults(changedWidgets) {
    const current = new Map();
    for (const device of this.devices) {
      const faults = activeFaults(device);
      current.set(String(device.id), faults);
      const before = this.faults.get(String(device.id)) ?? [];
      for (const fault of faults.filter((f) => !before.includes(f))) {
        logger.info(`Fault "${fault}" on ${device.name}`);
        changedWidgets.add('faults');
        await this.publishEvent(SCENE_TRIGGERS.DEVICE_FAULT, {
          device: deviceIds(this.gladys, device).device,
          fault,
          device_name: String(device.name ?? device.id),
        });
      }
      if (before.length !== faults.length) {
        changedWidgets.add('faults');
      }
    }
    this.faults = current;
  }

  rememberBaseline(timeline) {
    for (const device of this.devices) {
      this.faults.set(String(device.id), activeFaults(device));
    }
    for (const event of timeline) {
      this.seenEvents.add(eventId(event));
      if (!this.lastAlarm && alarmType(event)) {
        this.lastAlarm = event;
      }
    }
  }

  async fireAlarms(timeline, changedWidgets) {
    // The timeline lists the newest first: fire the oldest new alarm first.
    const fresh = timeline.filter((event) => !this.seenEvents.has(eventId(event))).reverse();
    for (const event of fresh) {
      this.seenEvents.add(eventId(event));
      const type = alarmType(event);
      if (!type) {
        continue;
      }
      this.lastAlarm = event;
      changedWidgets.add('alarm');
      const device = this.devices.find((d) => String(d.id) === String(event.device_id));
      logger.info(`Alarm: ${type} (${event.event_name ?? 'unknown event'})`);
      await this.publishEvent(SCENE_TRIGGERS.ALARM_TRIGGERED, {
        device: device ? deviceIds(this.gladys, device).device : null,
        alarm_type: type,
        device_name: String(event.device_name ?? device?.name ?? ''),
        event_name: String(event.event_name ?? ''),
      });
    }
    // Bound the memory: only the latest events can show up again.
    if (this.seenEvents.size > MAX_SEEN_EVENTS) {
      this.seenEvents = new Set([...this.seenEvents].slice(-MAX_SEEN_EVENTS));
    }
  }

  async publishEvent(key, data) {
    try {
      await this.gladys.publishSceneEvent(key, data);
    } catch (err) {
      logger.error(`Scene event ${key} refused: ${err.message}`);
    }
  }

  // --- Commands ------------------------------------------------------------------

  requireClient() {
    if (!this.client) {
      throw new Error('Abode is not configured');
    }
    return this.client;
  }

  /** Set the alarm mode; resolves the mode Abode confirms. */
  async setMode(mode) {
    const value = String(mode).toLowerCase();
    if (!ABODE_MODES.includes(value)) {
      throw new Error(`Unknown alarm mode "${mode}" (standby, home or away)`);
    }
    const confirmed = await this.requireClient().setMode(value);
    if (this.panel) {
      await this.gladys.publishChangedStates([
        {
          device_feature_external_id: panelIds(this.gladys, this.panel).feature(FEATURE.MODE),
          text: confirmed,
        },
      ]);
    }
    // The next read sees the new mode, fires `mode_changed` and refreshes
    // the widgets.
    this.schedule(AFTER_COMMAND_REFRESH_MS);
    return confirmed;
  }

  /** Gladys command on one feature (onSetValue). */
  async setValue(featureExternalId, value) {
    const target = resolveFeature(this.gladys, this.panel, this.devices, featureExternalId);
    if (!target) {
      throw new Error(`Unknown Abode feature ${featureExternalId}`);
    }
    if (target.target === 'panel') {
      await this.setMode(value);
      return;
    }
    const client = this.requireClient();
    const command = deviceCommand(target.key, value);
    if (command.call === 'level') {
      await client.setLevel(target.device, command.value);
    } else {
      await client.setStatus(target.device, command.value);
    }
    if (target.key !== FEATURE.COVER) {
      await this.gladys.publishState(featureExternalId, command.value);
    }
    this.schedule(AFTER_COMMAND_REFRESH_MS);
  }

  findDevice(externalId) {
    return this.devices.find((device) => deviceIds(this.gladys, device).device === externalId);
  }

  /** Fresh `image/jpg;base64,...` image of a camera device. */
  async getImage(externalId) {
    const device = this.findDevice(externalId);
    if (!device || detectKind(device) !== 'camera') {
      throw new Error(`${externalId} is not an Abode camera`);
    }
    const buffer = await this.requireClient().snapshot(device);
    if (!buffer) {
      throw new Error(`Abode returned no image for ${device.name}`);
    }
    return toCameraImage(buffer);
  }

  /** Capture an image and publish it on the camera device. */
  async captureImage(externalId) {
    const image = await this.getImage(externalId);
    await this.gladys.publishCameraImage(externalId, image);
    return true;
  }

  async listAutomations() {
    const automations = await this.requireClient().getAutomations();
    return automations.map((automation) => ({
      id: String(automation.id),
      name: String(automation.name ?? automation.id),
      enabled: automation.enabled !== false,
    }));
  }

  /** Run an automation chosen by id or by name (case-insensitive). */
  async triggerAutomation(idOrName) {
    const wanted = String(idOrName ?? '')
      .trim()
      .toLowerCase();
    if (!wanted) {
      throw new Error('No automation given');
    }
    const automations = await this.listAutomations();
    const automation =
      automations.find((a) => a.id.toLowerCase() === wanted) ??
      automations.find((a) => a.name.toLowerCase() === wanted);
    if (!automation) {
      return null;
    }
    await this.requireClient().applyAutomation(automation.id);
    this.schedule(AFTER_COMMAND_REFRESH_MS);
    return automation;
  }

  // --- Read model for the widgets ------------------------------------------------

  openings() {
    return openings(this.devices);
  }

  faultCount() {
    return this.devices.filter((device) => activeFaults(device).length > 0).length;
  }

  recentEvents(limit) {
    return this.timeline.slice(0, limit).map((event) => ({
      name: String(event.event_name ?? event.event_type ?? 'Event'),
      device: String(event.device_name ?? ''),
      date: eventDate(event),
      alarm: alarmType(event) !== null,
    }));
  }
}

function openingsKey(devices) {
  return openings(devices)
    .map(({ device, open }) => `${device.id}:${open}`)
    .join(',');
}

function timelineKey(timeline) {
  return timeline.map(eventId).join(',');
}
