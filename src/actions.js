// -----------------------------------------------------------------------------
// Manifest actions: the buttons of the Configuration screen (manifest
// `actions`). Each handler resolves the multi-language message displayed
// under the button; throwing displays the error instead.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { t } from './i18n.js';

const logger = createLogger({ name: 'actions' });

export const ACTIONS = {
  // Read Abode now and report what was found.
  async test_connection(monitor) {
    logger.info('Action test_connection');
    if (!monitor.client) {
      return t('status_not_configured');
    }
    const ok = await monitor.refresh();
    if (!ok) {
      throw new Error(monitor.lastError?.message ?? 'Abode cannot be reached');
    }
    return t('connection_ok', {
      devices: monitor.devices.length,
      mode: t(`mode_${monitor.mode ?? 'unknown'}`),
    });
  },

  // Names of the automations, to type in the "Run an Abode automation" scene
  // action.
  async list_automations(monitor) {
    logger.info('Action list_automations');
    if (!monitor.client) {
      return t('status_not_configured');
    }
    const automations = await monitor.listAutomations();
    if (automations.length === 0) {
      return t('automations_none');
    }
    const list = automations.map((automation) => automation.name).join(', ');
    return t('automations_list', { list: list.length > 400 ? `${list.slice(0, 399)}…` : list });
  },

  async set_mode(monitor, fields) {
    logger.info(`Action set_mode <- ${fields.mode}`);
    const mode = await monitor.setMode(fields.mode);
    return t('mode_set', { mode: t(`mode_${mode}`) });
  },
};
