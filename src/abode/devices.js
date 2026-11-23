// -----------------------------------------------------------------------------
// Abode -> Gladys device mapping.
//
// Turns the JSON of the Abode cloud (the panel and `/api/v1/devices`) into
// Gladys discovery payloads and states, and Gladys commands back into Abode
// calls. Pure functions, no I/O: test/devices.test.js drives them with
// recorded Abode payloads.
//
// External ids are forever: a device id is derived from the id Abode gives
// the device (`ZB:00a1b2c3` -> `zb-00a1b2c3`), never from its name, and the
// feature keys below are never renamed.
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES as CATEGORIES,
  DEVICE_FEATURE_TYPES as TYPES,
  DEVICE_FEATURE_UNITS as UNITS,
} from '@gladysassistant/integration-sdk';
import { ABODE_MODES } from './client.js';

export const PANEL_TYPE = 'panel';
export const DEVICE_TYPE = 'device';

// Feature keys (part of the external ids: never rename one).
export const FEATURE = {
  MODE: 'mode',
  OPENING: 'opening',
  MOTION: 'motion',
  LEAK: 'leak',
  SMOKE: 'smoke',
  CO: 'co',
  LOCK: 'lock',
  SWITCH: 'switch',
  LIGHT: 'light',
  BRIGHTNESS: 'brightness',
  VALVE: 'valve',
  COVER: 'cover',
  TEMPERATURE: 'temperature',
  HUMIDITY: 'humidity',
  LUX: 'lux',
  CAMERA: 'camera',
  BATTERY_LOW: 'battery-low',
  TAMPER: 'tamper',
};

// Gladys cover command values.
export const COVER_STATE = { OPEN: 1, STOP: 0, CLOSE: -1 };

// Labels of the alarm modes in the mode select (a supported option label is a
// plain string: Abode's own names, the ones its app shows).
const MODE_OPTIONS = [
  { value: 'standby', label: 'Standby' },
  { value: 'home', label: 'Home' },
  { value: 'away', label: 'Away' },
];

// Abode `type_tag` -> kind of device handled by this integration.
const KIND_BY_TYPE_TAG = {
  'device_type.door_contact': 'opening',
  'device_type.window_contact': 'opening',
  'device_type.secure_barrier': 'cover',
  'device_type.pir': 'motion',
  'device_type.povs': 'motion',
  'device_type.motion_sensor': 'motion',
  'device_type.ir_camcoder': 'camera',
  'device_type.ir_camera': 'camera',
  'device_type.ipcam': 'camera',
  'device_type.out_view_ir_camera': 'camera',
  'device_type.water_sensor': 'water',
  'device_type.smoke_detector': 'smoke',
  'device_type.sco': 'smoke',
  'device_type.co': 'co',
  'device_type.door_lock': 'lock',
  'device_type.switch': 'switch',
  'device_type.night_switch': 'switch',
  'device_type.power_switch_sensor': 'switch',
  'device_type.power_switch_meter': 'switch',
  'device_type.dimmer': 'light',
  'device_type.dimmer_meter': 'light',
  'device_type.hue': 'light',
  'device_type.bulb': 'light',
  'device_type.valve': 'valve',
  'device_type.room_sensor': 'sensor',
  'device_type.temperature_sensor': 'sensor',
  'device_type.lm': 'sensor',
};

// Fallback for type tags the table above does not know, first match wins.
const KIND_PATTERNS = [
  [/contact|door|window/, 'opening'],
  [/cam/, 'camera'],
  [/lock/, 'lock'],
  [/dimmer|bulb|light|hue/, 'light'],
  [/switch|plug|outlet/, 'switch'],
  [/valve/, 'valve'],
  [/water|leak|flood/, 'water'],
  [/smoke/, 'smoke'],
  [/pir|motion/, 'motion'],
  [/temp|room_sensor|multi/, 'sensor'],
];

// Statuses meaning "nothing to report" for an event-like sensor.
const IDLE_STATUSES = new Set([
  '',
  '0',
  'off',
  'offline',
  'online',
  'closed',
  'dry',
  'normal',
  'idle',
  'no motion',
  'clear',
]);

/** Abode id -> the part of the external id that names the device. */
export function platformId(abodeId) {
  return String(abodeId)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Kind of an Abode device (`opening`, `light`...), `other` when unknown. */
export function detectKind(device) {
  const tag = String(device?.type_tag ?? '').toLowerCase();
  if (KIND_BY_TYPE_TAG[tag]) {
    return KIND_BY_TYPE_TAG[tag];
  }
  for (const [pattern, kind] of KIND_PATTERNS) {
    if (pattern.test(tag)) {
      return kind;
    }
  }
  return 'other';
}

/** Alarm mode of a panel (`standby` | `home` | `away`), null when unknown. */
export function panelMode(panel) {
  const mode = panel?.mode?.area_1 ?? panel?.mode;
  return typeof mode === 'string' && ABODE_MODES.includes(mode) ? mode : null;
}

export function panelIds(gladys, panel) {
  const id = panel?.mac ?? panel?.serial ?? panel?.uuid ?? 'main';
  return gladys.externalIds(PANEL_TYPE, platformId(id));
}

export function deviceIds(gladys, device) {
  return gladys.externalIds(DEVICE_TYPE, platformId(device.id));
}

// --- Status parsing ------------------------------------------------------------

const status = (device) =>
  String(device?.status ?? '')
    .trim()
    .toLowerCase();

const truthy = (value) =>
  value === true || value === 1 || ['1', 'true', 'on', 'yes'].includes(String(value).toLowerCase());

/** First number of a status such as "21.5 °C", "48 %" or 21.5; null otherwise. */
export function parseNumber(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  const match = String(value ?? '').match(/-?\d+(?:[.,]\d+)?/);
  return match ? Number(match[0].replace(',', '.')) : null;
}

function statusValue(device, ...keys) {
  for (const key of keys) {
    const value = device?.statuses?.[key];
    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
  }
  return undefined;
}

function isActive(device) {
  return IDLE_STATUSES.has(status(device)) ? 0 : 1;
}

function temperatureUnit(device) {
  const raw = `${statusValue(device, 'temperature', 'temp') ?? ''} ${statusValue(device, 'temperature_unit', 'temp_unit') ?? ''}`;
  return /°?\s*F\b|fahrenheit/i.test(raw) ? UNITS.FAHRENHEIT : UNITS.CELSIUS;
}

// Gladys reads an opening sensor as 1 = closed, 0 = open (a contact).
function openingState(device) {
  return ['closed', 'lockclosed'].includes(status(device)) ? 1 : 0;
}

function onOffState(device) {
  const s = status(device);
  return ['on', 'open', '1', 'lockclosed'].includes(s) ? 1 : 0;
}

function lockState(device) {
  const s = status(device);
  return s === 'lockclosed' || s === 'locked' || s === '1' ? 1 : 0;
}

function motionState(device) {
  const value = statusValue(device, 'motion', 'motion_status');
  if (value !== undefined) {
    return truthy(value) || /motion/i.test(String(value)) ? 1 : 0;
  }
  return /motion|active/.test(status(device)) && status(device) !== 'no motion' ? 1 : 0;
}

function levelState(device) {
  const level = parseNumber(statusValue(device, 'level', 'brightness'));
  return level === null ? null : Math.min(100, Math.max(0, Math.round(level)));
}

function hasFault(device, key) {
  return device?.faults && Object.prototype.hasOwnProperty.call(device.faults, key);
}

// --- Feature catalog -----------------------------------------------------------

// Every feature carries name, min, max, read_only and has_feedback: Gladys
// stores them NOT NULL (HTTP 422 on "Add" otherwise).
const binarySensor = (name, category) => ({
  name,
  category,
  type: TYPES.SENSOR.BINARY,
  min: 0,
  max: 1,
  read_only: true,
  has_feedback: false,
  keep_history: true,
});

const decimalSensor = (name, category, unit, min, max) => ({
  name,
  category,
  type: TYPES.SENSOR.DECIMAL,
  unit,
  min,
  max,
  read_only: true,
  has_feedback: false,
  keep_history: true,
});

const actuator = (name, category, type, min = 0, max = 1) => ({
  name,
  category,
  type,
  min,
  max,
  read_only: false,
  has_feedback: true,
  keep_history: true,
});

// key -> { build(device), read(device) -> state | null }
const FEATURES = {
  [FEATURE.OPENING]: {
    build: () => binarySensor('Opening', CATEGORIES.OPENING_SENSOR),
    read: openingState,
  },
  [FEATURE.MOTION]: {
    build: () => binarySensor('Motion', CATEGORIES.MOTION_SENSOR),
    read: motionState,
  },
  [FEATURE.LEAK]: {
    build: () => binarySensor('Water leak', CATEGORIES.LEAK_SENSOR),
    read: isActive,
  },
  [FEATURE.SMOKE]: {
    build: () => binarySensor('Smoke', CATEGORIES.SMOKE_SENSOR),
    read: isActive,
  },
  [FEATURE.CO]: {
    build: () => binarySensor('Carbon monoxide', CATEGORIES.CO_SENSOR),
    read: isActive,
  },
  [FEATURE.LOCK]: {
    build: () => actuator('Lock', CATEGORIES.LOCK, TYPES.LOCK.BINARY),
    read: lockState,
  },
  [FEATURE.SWITCH]: {
    build: () => actuator('Power', CATEGORIES.SWITCH, TYPES.SWITCH.BINARY),
    read: onOffState,
  },
  [FEATURE.LIGHT]: {
    build: () => actuator('Power', CATEGORIES.LIGHT, TYPES.LIGHT.BINARY),
    read: onOffState,
  },
  [FEATURE.BRIGHTNESS]: {
    build: () => ({
      ...actuator('Brightness', CATEGORIES.LIGHT, TYPES.LIGHT.BRIGHTNESS, 0, 100),
      unit: UNITS.PERCENT,
    }),
    read: levelState,
  },
  [FEATURE.VALVE]: {
    build: () => actuator('Valve open', CATEGORIES.SWITCH, TYPES.SWITCH.BINARY),
    read: onOffState,
  },
  [FEATURE.COVER]: {
    // A command feature (open / close buttons): its state is the last command.
    build: () => ({
      ...actuator('Open / close', CATEGORIES.SHUTTER, TYPES.SHUTTER.STATE, -1, 1),
      has_feedback: false,
      keep_history: false,
    }),
    read: () => null,
  },
  [FEATURE.TEMPERATURE]: {
    build: (device) => {
      const unit = temperatureUnit(device);
      // -40 is the same in both scales; 70 °C = 158 °F.
      return decimalSensor(
        'Temperature',
        CATEGORIES.TEMPERATURE_SENSOR,
        unit,
        -40,
        unit === UNITS.FAHRENHEIT ? 158 : 70,
      );
    },
    read: (device) => parseNumber(statusValue(device, 'temperature', 'temp')),
  },
  [FEATURE.HUMIDITY]: {
    build: () => decimalSensor('Humidity', CATEGORIES.HUMIDITY_SENSOR, UNITS.PERCENT, 0, 100),
    read: (device) => parseNumber(statusValue(device, 'humidity')),
  },
  [FEATURE.LUX]: {
    build: () => decimalSensor('Light level', CATEGORIES.LIGHT_SENSOR, UNITS.LUX, 0, 100000),
    read: (device) => parseNumber(statusValue(device, 'lux', 'light')),
  },
  [FEATURE.CAMERA]: {
    // Images go through the camera channel (onGetImage), never the states.
    build: () => ({
      name: 'Image',
      category: CATEGORIES.CAMERA,
      type: TYPES.CAMERA.IMAGE,
      min: 0,
      max: 0,
      read_only: true,
      has_feedback: false,
      keep_history: false,
    }),
    read: () => null,
  },
  [FEATURE.BATTERY_LOW]: {
    build: () => binarySensor('Low battery', CATEGORIES.BATTERY_LOW),
    read: (device) => (truthy(device.faults?.low_battery) ? 1 : 0),
  },
  [FEATURE.TAMPER]: {
    build: () => binarySensor('Tamper', CATEGORIES.TAMPER),
    read: (device) => (truthy(device.faults?.tempered) ? 1 : 0),
  },
};

// Main features of each kind of device; fault features are added on top.
const FEATURES_BY_KIND = {
  opening: [FEATURE.OPENING],
  motion: [FEATURE.MOTION],
  water: [FEATURE.LEAK],
  smoke: [FEATURE.SMOKE],
  co: [FEATURE.CO],
  lock: [FEATURE.LOCK],
  switch: [FEATURE.SWITCH],
  light: [FEATURE.LIGHT],
  valve: [FEATURE.VALVE],
  cover: [FEATURE.COVER, FEATURE.OPENING],
  sensor: [],
  camera: [FEATURE.CAMERA],
  other: [],
};

/** Feature keys published for an Abode device. */
export function featureKeys(device) {
  const kind = detectKind(device);
  const keys = [...FEATURES_BY_KIND[kind]];
  if (kind === 'light' && levelState(device) !== null) {
    keys.push(FEATURE.BRIGHTNESS);
  }
  if (statusValue(device, 'temperature', 'temp') !== undefined) keys.push(FEATURE.TEMPERATURE);
  if (statusValue(device, 'humidity') !== undefined) keys.push(FEATURE.HUMIDITY);
  if (statusValue(device, 'lux', 'light') !== undefined) keys.push(FEATURE.LUX);
  if (hasFault(device, 'low_battery')) keys.push(FEATURE.BATTERY_LOW);
  if (hasFault(device, 'tempered')) keys.push(FEATURE.TAMPER);
  return keys;
}

// --- Discovery -----------------------------------------------------------------

export function buildPanelDevice(gladys, panel) {
  const ids = panelIds(gladys, panel);
  return {
    name: typeof panel?.name === 'string' && panel.name ? panel.name : 'Abode alarm',
    external_id: ids.device,
    model: panel?.model ? String(panel.model) : undefined,
    should_poll: false,
    features: [
      {
        name: 'Alarm mode',
        external_id: ids.feature(FEATURE.MODE),
        category: CATEGORIES.TEXT,
        type: TYPES.TEXT.SELECT,
        min: 0,
        max: 0,
        read_only: false,
        has_feedback: true,
        keep_history: true,
        supported_options: MODE_OPTIONS.map((option, index) => ({ ...option, sort_order: index })),
      },
    ],
  };
}

/** Discovery payload of one Abode device; null for a device with no feature. */
export function buildAbodeDevice(gladys, device) {
  const keys = featureKeys(device);
  if (keys.length === 0) {
    return null;
  }
  const ids = deviceIds(gladys, device);
  return {
    name: typeof device.name === 'string' && device.name ? device.name : String(device.id),
    external_id: ids.device,
    model: device.type ? String(device.type) : undefined,
    should_poll: false,
    params: [{ name: 'abode_id', value: String(device.id) }],
    features: keys.map((key) => ({
      ...FEATURES[key].build(device),
      external_id: ids.feature(key),
    })),
  };
}

/** Panel first, then every Abode device that has at least one feature. */
export function buildDiscoveredDevices(gladys, panel, devices) {
  const list = panel ? [buildPanelDevice(gladys, panel)] : [];
  for (const device of devices ?? []) {
    const built = buildAbodeDevice(gladys, device);
    if (built) {
      list.push(built);
    }
  }
  return list;
}

/**
 * Fingerprint of what the discovery payload depends on: when it changes (a
 * device added in Abode, a dimmer reporting its level...) the devices are
 * published again.
 */
export function discoverySignature(panel, devices) {
  const parts = (devices ?? []).map(
    (device) => `${device.id}|${device.name}|${featureKeys(device).join(',')}`,
  );
  return [panel?.mac ?? panel?.serial ?? '', panel?.name ?? '', ...parts.sort()].join('\n');
}

// --- States --------------------------------------------------------------------

/** Every state the panel and the devices currently report. */
export function buildStates(gladys, panel, devices) {
  const states = [];
  if (panel) {
    const mode = panelMode(panel);
    if (mode) {
      states.push({
        device_feature_external_id: panelIds(gladys, panel).feature(FEATURE.MODE),
        text: mode,
      });
    }
  }
  for (const device of devices ?? []) {
    const ids = deviceIds(gladys, device);
    for (const key of featureKeys(device)) {
      const value = FEATURES[key].read(device);
      if (value !== null && value !== undefined && Number.isFinite(value)) {
        states.push({ device_feature_external_id: ids.feature(key), state: value });
      }
    }
  }
  return states;
}

// --- Commands ------------------------------------------------------------------

/**
 * Locate the Abode target of a Gladys feature external_id.
 * @returns {{ target: 'panel' } | { target: 'device', device: object } | null} with `key`
 */
export function resolveFeature(gladys, panel, devices, featureExternalId) {
  if (panel) {
    const ids = panelIds(gladys, panel);
    if (featureExternalId === ids.feature(FEATURE.MODE)) {
      return { target: 'panel', key: FEATURE.MODE };
    }
  }
  for (const device of devices ?? []) {
    const prefix = `${deviceIds(gladys, device).device}:`;
    if (featureExternalId.startsWith(prefix)) {
      return { target: 'device', device, key: featureExternalId.slice(prefix.length) };
    }
  }
  return null;
}

/**
 * Abode call for a Gladys command on a device feature.
 * @returns {{ call: 'status', value: number } | { call: 'level', value: number }}
 */
export function deviceCommand(key, value) {
  const number = Number(value);
  switch (key) {
    case FEATURE.LOCK:
    case FEATURE.SWITCH:
    case FEATURE.LIGHT:
    case FEATURE.VALVE:
      return { call: 'status', value: number === 1 ? 1 : 0 };
    case FEATURE.BRIGHTNESS:
      return { call: 'level', value: Math.min(100, Math.max(0, Math.round(number))) };
    case FEATURE.COVER:
      if (number === COVER_STATE.OPEN) return { call: 'status', value: 1 };
      if (number === COVER_STATE.CLOSE) return { call: 'status', value: 0 };
      throw new Error('Abode garage doors cannot be stopped: open or close only');
    default:
      throw new Error(`The feature "${key}" cannot be controlled`);
  }
}

/** Opening sensors (doors, windows, garage doors) with their open state. */
export function openings(devices) {
  return (devices ?? [])
    .filter((device) => ['opening', 'cover'].includes(detectKind(device)))
    .map((device) => ({ device, open: openingState(device) === 0 }));
}

/** Active faults of a device: `low_battery`, `tamper`, `offline`... */
export function activeFaults(device) {
  const faults = [];
  if (truthy(device?.faults?.low_battery)) faults.push('low_battery');
  if (truthy(device?.faults?.tempered)) faults.push('tamper');
  if (truthy(device?.faults?.no_response) || status(device) === 'offline') faults.push('offline');
  if (truthy(device?.faults?.jammed)) faults.push('jammed');
  return faults;
}
