// -----------------------------------------------------------------------------
// Integration configuration.
//
// Filled in by the user from the `config_schema` of
// `gladys-assistant-integration.json`; the SDK fetches it (`getConfig()`) and
// notifies every change (`onConfigUpdated()`). This module provides the
// defaults and normalizes the received object, so the rest of the code never
// deals with `undefined` or with numbers typed as strings.
// -----------------------------------------------------------------------------

// Bounds of the refresh interval, in seconds: the Abode cloud is polled by the
// integration itself (Gladys' own poll is at most once a minute, too slow for
// an alarm), and polling faster than every 10 s gains nothing but load.
export const MIN_REFRESH_INTERVAL = 10;
export const MAX_REFRESH_INTERVAL = 300;

// Defaults: they MUST stay consistent with the `default` values declared in
// the manifest `config_schema` (checked by test/manifest.test.js).
export const DEFAULT_CONFIG = {
  username: '',
  password: '',
  // Seconds between two reads of the Abode cloud (panel, devices, timeline).
  refresh_interval: 15,
};

/**
 * Merge the user config with the defaults.
 * @param {Record<string, unknown>} raw - Config returned by the SDK.
 */
export function normalizeConfig(raw = {}) {
  const interval = Number(raw.refresh_interval ?? DEFAULT_CONFIG.refresh_interval);
  return {
    ...DEFAULT_CONFIG,
    ...raw,
    username: String(raw.username ?? '').trim(),
    password: String(raw.password ?? ''),
    refresh_interval: Number.isFinite(interval)
      ? Math.min(MAX_REFRESH_INTERVAL, Math.max(MIN_REFRESH_INTERVAL, Math.round(interval)))
      : DEFAULT_CONFIG.refresh_interval,
  };
}

/** Whether the user filled in the credentials. */
export function isConfigured(config) {
  return config.username.length > 0 && config.password.length > 0;
}
