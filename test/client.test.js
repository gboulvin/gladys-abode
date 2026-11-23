import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AbodeApiError, AbodeAuthError, AbodeClient } from '../src/abode/client.js';

// A fake fetch answering from a route table; records every request.
function fakeFetch(routes) {
  const requests = [];
  const fetch = async (url, init) => {
    const key = `${init.method} ${url.pathname}`;
    requests.push({ key, url, init });
    const route = routes[key];
    if (!route) {
      return new Response('{"message":"not found"}', { status: 404 });
    }
    const {
      status = 200,
      body = {},
      cookies = [],
    } = typeof route === 'function' ? route(init, requests) : route;
    const headers = new Headers({ 'content-type': 'application/json' });
    for (const cookie of cookies) {
      headers.append('set-cookie', cookie);
    }
    return new Response(JSON.stringify(body), { status, headers });
  };
  return { fetch, requests };
}

const LOGIN_OK = {
  'POST /api/auth2/login': {
    body: { token: 'api-key', panel: {}, user: {} },
    cookies: ['SESSION=abc; Path=/; HttpOnly'],
  },
  'GET /api/auth2/claims': { body: { access_token: 'oauth' } },
};

const newClient = (fetch) =>
  new AbodeClient({ username: 'me@example.com', password: 'pw', uuid: 'uuid-1', fetch });

test('login sends the credentials and the uuid, then carries the tokens and the cookie', async () => {
  const { fetch, requests } = fakeFetch({
    ...LOGIN_OK,
    'GET /api/v1/panel': { body: { mode: { area_1: 'away' } } },
  });
  const client = newClient(fetch);
  const panel = await client.getPanel();
  assert.equal(panel.mode.area_1, 'away');
  assert.deepEqual(JSON.parse(requests[0].init.body), {
    id: 'me@example.com',
    password: 'pw',
    uuid: 'uuid-1',
  });
  const headers = requests[2].init.headers;
  assert.equal(headers['ABODE-API-KEY'], 'api-key');
  assert.equal(headers.Authorization, 'Bearer oauth');
  assert.equal(headers.Cookie, 'SESSION=abc');
  assert.equal(requests[1].init.headers.Cookie, 'SESSION=abc', 'the claims need the cookie');
});

test('refused credentials raise an AbodeAuthError', async () => {
  const { fetch } = fakeFetch({
    'POST /api/auth2/login': { status: 400, body: { message: 'Invalid credentials' } },
  });
  await assert.rejects(newClient(fetch).getPanel(), (err) => {
    assert.ok(err instanceof AbodeAuthError);
    assert.equal(err.mfa, false);
    assert.match(err.message, /Invalid credentials/);
    return true;
  });
});

test('an account asking for a second factor raises an MFA AbodeAuthError', async () => {
  const { fetch } = fakeFetch({
    'POST /api/auth2/login': { body: { mfa_type: 'google_authenticator' } },
  });
  await assert.rejects(newClient(fetch).getPanel(), (err) => err.mfa === true);
});

test('an expired session is renewed once', async () => {
  let panelCalls = 0;
  const { fetch, requests } = fakeFetch({
    ...LOGIN_OK,
    'GET /api/v1/panel': () => {
      panelCalls += 1;
      return panelCalls === 1 ? { status: 401, body: {} } : { body: { mode: { area_1: 'home' } } };
    },
  });
  const panel = await newClient(fetch).getPanel();
  assert.equal(panel.mode.area_1, 'home');
  assert.equal(requests.filter((r) => r.key === 'POST /api/auth2/login').length, 2);
});

test('setMode calls the mode endpoint and checks the answer', async () => {
  const { fetch, requests } = fakeFetch({
    ...LOGIN_OK,
    'PUT /api/v1/panel/mode/1/away': { body: { area: '1', mode: 'away' } },
    'PUT /api/v1/panel/mode/1/home': { body: { area: '1', mode: 'standby' } },
  });
  const client = newClient(fetch);
  assert.equal(await client.setMode('away'), 'away');
  assert.ok(requests.some((r) => r.key === 'PUT /api/v1/panel/mode/1/away'));
  await assert.rejects(client.setMode('home'), AbodeApiError);
  await assert.rejects(client.setMode('party'), /Unknown Abode mode/);
});

test('device commands are form-encoded on the control URL', async () => {
  const { fetch, requests } = fakeFetch({
    ...LOGIN_OK,
    'PUT /api/v1/control/light/ZW:4': { body: { id: 'ZW:4', level: '40' } },
  });
  const client = newClient(fetch);
  await client.setLevel({ id: 'ZW:4', control_url: 'api/v1/control/light/ZW:4' }, 40);
  const request = requests.at(-1);
  assert.equal(request.init.headers['Content-Type'], 'application/x-www-form-urlencoded');
  assert.equal(request.init.body, 'level=40');
  await assert.rejects(client.setStatus({ id: 'RF:1' }, 1), /cannot be controlled/);
});

test('an unreachable cloud raises an AbodeApiError', async () => {
  const client = newClient(async () => {
    throw new TypeError('fetch failed');
  });
  await assert.rejects(client.getDevices(), (err) => {
    assert.ok(err instanceof AbodeApiError);
    assert.match(err.message, /unreachable/);
    return true;
  });
});

test('snapshot decodes the base64 image of the camera', async () => {
  const { fetch } = fakeFetch({
    ...LOGIN_OK,
    'POST /integrations/v1/camera/cam-1/snapshot': {
      body: { base64Image: Buffer.from('jpeg').toString('base64') },
    },
  });
  const buffer = await newClient(fetch).snapshot({ id: 'XF:1', uuid: 'cam-1' });
  assert.equal(buffer.toString(), 'jpeg');
});
