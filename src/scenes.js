// -----------------------------------------------------------------------------
// Scene actions (manifest `scene_actions`, Gladys 5.1+).
//
// Each handler receives the RESOLVED fields (scene variables substituted,
// defaults applied, validated by the core) and returns the declared scalar
// `outputs`. Throwing fails this action only: the scene logs it and goes on.
// A result the scene author may want to test (an unknown automation...) is an
// output, not an error.
//
// The scene TRIGGERS (mode_changed, alarm_triggered, device_fault) need no
// handler: the monitor fires them on transitions (src/abode/monitor.js).
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';

const logger = createLogger({ name: 'scenes' });

export const SCENE_ACTIONS = {
  async set_mode(monitor, { fields }) {
    logger.info(`Scene action set_mode <- ${fields.mode}`);
    const mode = await monitor.setMode(fields.mode);
    return { mode };
  },

  async trigger_automation(monitor, { fields }) {
    logger.info('Scene action trigger_automation');
    const automation = await monitor.triggerAutomation(fields.automation);
    if (!automation) {
      logger.warn(`No Abode automation matches "${fields.automation}"`);
      return { triggered: false, automation_name: '' };
    }
    return { triggered: true, automation_name: automation.name };
  },

  async capture_image(monitor, { fields }) {
    logger.info(`Scene action capture_image <- ${fields.camera}`);
    try {
      return { captured: await monitor.captureImage(fields.camera) };
    } catch (err) {
      logger.warn(`Capture failed: ${err.message}`);
      return { captured: false };
    }
  },
};
