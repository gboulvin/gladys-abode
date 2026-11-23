// -----------------------------------------------------------------------------
// Abode cloud client.
//
// Abode has no documented local API: everything goes through the cloud
// (https://my.goabode.com), with the same endpoints the Abode web app uses —
// the ones the community clients (abodepy / jaraco.abode, behind the Home
// Assistant integration) rely on:
//
//   POST /api/auth2/login                  { id, password, uuid } -> { token, panel, user }
//   GET  /api/auth2/claims                 -> { access_token }  (session cookie)
//   GET  /api/v1/panel                     -> panel, mode in `mode.area_1`
//   PUT  /api/v1/panel/mode/1/<mode>       standby | home | away
//   GET  /api/v1/devices                   -> devices
//   PUT  /<control_url>                    form `status=0|1` or `level=0..100`
//   GET  /api/v1/timeline?size=N           -> recent events
//   GET  /integrations/v1/automations/     -> automations
//   POST /integrations/v1/automations/<id>/apply
//   POST /integrations/v1/camera/<uuid>/snapshot -> { base64Image }
//
// Every request carries the `ABODE-API-KEY` token, the OAuth bearer and the
// session cookie; an expired session (401/403) is renewed once, transparently.
// Credentials and tokens are never logged.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';

const logger = createLogger({ name: 'abode-client' });

export const ABODE_BASE_URL = 'https://my.goabode.com';
export const ABODE_MODES = ['standby', 'home', 'away'];
const DEFAULT_AREA = '1';
const REQUEST_TIMEOUT_MS = 20_000;

/** The credentials were refused, or the account needs a second factor. */
export class AbodeAuthError extends Error {
  constructor(message, { mfa = false } = {}) {
    super(message);
    this.name = 'AbodeAuthError';
    this.mfa = mfa;
  }
}

/** The Abode cloud answered an error, or could not be reached. */
export class AbodeApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'AbodeApiError';
    this.status = status;
  }
}

export class AbodeClient {
  /**
   * @param {object} options
   * @param {string} options.username - Abode account email.
   * @param {string} options.password - Abode account password.
   * @param {string} options.uuid - Stable client identifier (see storage.js).
   * @param {typeof fetch} [options.fetch] - Injected in the tests.
   * @param {string} [options.baseUrl]
   */
  constructor({ username, password, uuid, fetch: fetchImpl = globalThis.fetch, baseUrl }) {
    this.username = username;
    this.password = password;
    this.uuid = uuid;
    this.fetch = fetchImpl;
    this.baseUrl = baseUrl ?? ABODE_BASE_URL;
    this.cookies = new Map();
    this.apiKey = null;
    this.accessToken = null;
    this.loginPromise = null;
  }

  get isAuthenticated() {
    return this.apiKey !== null;
  }

  // --- Session -----------------------------------------------------------------

  /** Sign in; concurrent callers share the same attempt. */
  login() {
    if (!this.loginPromise) {
      this.loginPromise = this._login().finally(() => {
        this.loginPromise = null;
      });
    }
    return this.loginPromise;
  }

  async _login() {
    this.cookies.clear();
    this.apiKey = null;
    this.accessToken = null;
    logger.info('Signing in to the Abode cloud');
    const response = await this._fetch('POST', '/api/auth2/login', {
      json: { id: this.username, password: this.password, uuid: this.uuid },
    });
    const body = await readJson(response);
    if (response.status === 400 || response.status === 401 || response.status === 403) {
      throw new AbodeAuthError(errorMessage(body, 'Invalid Abode credentials'));
    }
    if (!response.ok) {
      throw new AbodeApiError(
        errorMessage(body, `Abode login failed (HTTP ${response.status})`),
        response.status,
      );
    }
    if (body?.mfa_type) {
      throw new AbodeAuthError('This Abode account requires a two-factor code', { mfa: true });
    }
    if (!body?.token) {
      throw new AbodeApiError('Abode login answered without a token', response.status);
    }
    this.apiKey = body.token;

    const claims = await this._fetch('GET', '/api/auth2/claims');
    const claimsBody = await readJson(claims);
    if (!claims.ok || !claimsBody?.access_token) {
      this.apiKey = null;
      throw new AbodeApiError('Abode did not deliver an access token', claims.status);
    }
    this.accessToken = claimsBody.access_token;
    logger.info('Signed in to the Abode cloud');
    return body;
  }

  /** Close the session on Abode's side (best effort). */
  async logout() {
    if (!this.isAuthenticated) {
      return;
    }
    try {
      await this._fetch('POST', '/api/v1/logout');
    } catch (err) {
      logger.debug(`Logout failed: ${err.message}`);
    }
    this.cookies.clear();
    this.apiKey = null;
    this.accessToken = null;
  }

  // --- Generic request ---------------------------------------------------------

  /**
   * Authenticated request; renews the session once on 401/403.
   * @returns {Promise<any>} Parsed JSON body (or null).
   */
  async request(method, path, { json, form, retry = true } = {}) {
    if (!this.isAuthenticated) {
      await this.login();
    }
    const response = await this._fetch(method, path, { json, form });
    if ((response.status === 401 || response.status === 403) && retry) {
      logger.info('Abode session expired, signing in again');
      await this.login();
      return this.request(method, path, { json, form, retry: false });
    }
    const body = await readJson(response);
    if (!response.ok) {
      throw new AbodeApiError(
        errorMessage(
          body,
          `Abode answered HTTP ${response.status} to ${method} ${stripQuery(path)}`,
        ),
        response.status,
      );
    }
    return body;
  }

  async _fetch(method, path, { json, form } = {}) {
    const url = new URL(path.startsWith('/') ? path : `/${path}`, this.baseUrl);
    const headers = {
      Accept: 'application/json',
      Origin: this.baseUrl,
      'User-Agent': 'gladys-abode',
    };
    if (this.apiKey) {
      headers['ABODE-API-KEY'] = this.apiKey;
    }
    if (this.accessToken) {
      headers.Authorization = `Bearer ${this.accessToken}`;
    }
    if (this.cookies.size > 0) {
      headers.Cookie = [...this.cookies].map(([name, value]) => `${name}=${value}`).join('; ');
    }
    let body;
    if (json !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(json);
    } else if (form !== undefined) {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
      body = new URLSearchParams(form).toString();
    }
    let response;
    try {
      response = await this.fetch(url, {
        method,
        headers,
        body,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (err) {
      throw new AbodeApiError(`Abode cloud unreachable: ${err.message}`, 0);
    }
    this._storeCookies(response);
    return response;
  }

  _storeCookies(response) {
    const setCookies =
      typeof response.headers?.getSetCookie === 'function' ? response.headers.getSetCookie() : [];
    for (const cookie of setCookies) {
      const [pair] = cookie.split(';');
      const index = pair.indexOf('=');
      if (index > 0) {
        this.cookies.set(pair.slice(0, index).trim(), pair.slice(index + 1).trim());
      }
    }
  }

  // --- Panel -------------------------------------------------------------------

  getPanel() {
    return this.request('GET', '/api/v1/panel');
  }

  /** Set the alarm mode; resolves the mode Abode confirms. */
  async setMode(mode, area = DEFAULT_AREA) {
    if (!ABODE_MODES.includes(mode)) {
      throw new Error(`Unknown Abode mode "${mode}" (standby, home or away)`);
    }
    const body = await this.request('PUT', `/api/v1/panel/mode/${area}/${mode}`);
    if (body?.mode && body.mode !== mode) {
      throw new AbodeApiError(`Abode refused the mode "${mode}" (now "${body.mode}")`, 200);
    }
    return body?.mode ?? mode;
  }

  // --- Devices -----------------------------------------------------------------

  async getDevices() {
    const body = await this.request('GET', '/api/v1/devices');
    return Array.isArray(body) ? body : [];
  }

  /** Switch / lock / valve / cover: 1 = on, locked, open; 0 = off, unlocked, closed. */
  async setStatus(device, status) {
    return this.request('PUT', controlPath(device), { form: { status: String(status) } });
  }

  /** Dimmer level, 0 to 100. */
  async setLevel(device, level) {
    return this.request('PUT', controlPath(device), { form: { level: String(level) } });
  }

  // --- Timeline ----------------------------------------------------------------

  async getTimeline(size = 10) {
    const body = await this.request('GET', `/api/v1/timeline?size=${size}`);
    return Array.isArray(body) ? body : [];
  }

  // --- Automations -------------------------------------------------------------

  async getAutomations() {
    const body = await this.request('GET', '/integrations/v1/automations/');
    return Array.isArray(body) ? body : [];
  }

  applyAutomation(id) {
    return this.request('POST', `/integrations/v1/automations/${encodeURIComponent(id)}/apply`);
  }

  // --- Cameras -----------------------------------------------------------------

  /** Fresh snapshot of a camera, as a Buffer (null when Abode has none). */
  async snapshot(device) {
    const id = device.uuid ?? device.id;
    const body = await this.request(
      'POST',
      `/integrations/v1/camera/${encodeURIComponent(id)}/snapshot`,
    );
    if (!body?.base64Image) {
      return null;
    }
    return Buffer.from(body.base64Image, 'base64');
  }
}

function controlPath(device) {
  if (!device?.control_url) {
    throw new Error(`Abode device ${device?.id ?? '?'} cannot be controlled`);
  }
  return `/${String(device.control_url).replace(/^\/+/, '')}`;
}

async function readJson(response) {
  const text = await response.text();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function errorMessage(body, fallback) {
  const message = body?.message ?? body?.errorMessage ?? body?.detail;
  return typeof message === 'string' && message.length > 0 ? `Abode: ${message}` : fallback;
}

function stripQuery(path) {
  return path.split('?')[0];
}
