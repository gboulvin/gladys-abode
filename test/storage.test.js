import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadClientUuid } from '../src/abode/storage.js';

test('the client uuid is created once, then reused', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'gladys-abode-'));
  try {
    const first = await loadClientUuid(dir);
    assert.match(first, /^[0-9a-f-]{36}$/);
    assert.equal(await loadClientUuid(dir), first);
    assert.equal(JSON.parse(await readFile(join(dir, 'abode.json'), 'utf8')).uuid, first);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
