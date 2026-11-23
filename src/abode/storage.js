// -----------------------------------------------------------------------------
// Persistent client identifier.
//
// Abode identifies each client by a `uuid` sent at login, like a phone of the
// mobile app. Keeping the same one across restarts makes the integration one
// stable "device" in the Abode account instead of a new one at every start.
// It is stored under /data, the only writable volume of the container (the
// rootfs is read-only); when /data is not writable (local runs), a fresh uuid
// is kept in memory.
// -----------------------------------------------------------------------------

import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createLogger } from '@gladysassistant/integration-sdk';

const logger = createLogger({ name: 'storage' });

export const DATA_DIR = process.env.GLADYS_ABODE_DATA_DIR ?? '/data';
const STATE_FILE = 'abode.json';

/**
 * Read the client uuid, creating and saving it on first use.
 * @param {string} [dir] - Data directory.
 */
export async function loadClientUuid(dir = DATA_DIR) {
  const file = join(dir, STATE_FILE);
  try {
    const state = JSON.parse(await readFile(file, 'utf8'));
    if (typeof state.uuid === 'string' && state.uuid.length > 0) {
      return state.uuid;
    }
  } catch {
    // First start, or unreadable file: create a new identifier below.
  }
  const uuid = randomUUID();
  try {
    await mkdir(dir, { recursive: true });
    await writeFile(file, JSON.stringify({ uuid }, null, 2));
  } catch (err) {
    logger.warn(`Cannot save the client identifier under ${dir}: ${err.message}`);
  }
  return uuid;
}
