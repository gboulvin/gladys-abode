// -----------------------------------------------------------------------------
// Dashboard widgets (manifest `widgets`, Gladys 5.1+).
//
// The content is declarative (`value`, `status`, `card-list`, `button`...):
// the core renders it with its own theme and picks the language from the
// multi-language objects. Each entry of WIDGETS is keyed by the widget `key`:
//   - get(monitor, { settings })        -> the content (onWidgetGet);
//   - action(monitor, { actionKey, params, settings }) -> optional toast
//     (onWidgetAction).
//
// A dashboard can be shown to anyone in the house (a wall tablet...), and the
// acting user of a widget button is anonymous: disarming from the alarm
// widget is off unless the widget instance enables it, and every alarm
// button asks for a confirmation.
// -----------------------------------------------------------------------------

import { createLogger, WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import { t } from './i18n.js';

const logger = createLogger({ name: 'widgets' });

export const WIDGET_KEYS = {
  ALARM: 'abode_alarm',
  OPENINGS: 'abode_openings',
  TIMELINE: 'abode_timeline',
};

// Which widgets show which part of the monitor's data (see refreshWidgets).
const WIDGETS_BY_CHANGE = {
  mode: [WIDGET_KEYS.ALARM],
  connection: [WIDGET_KEYS.ALARM, WIDGET_KEYS.OPENINGS, WIDGET_KEYS.TIMELINE],
  openings: [WIDGET_KEYS.ALARM, WIDGET_KEYS.OPENINGS],
  faults: [WIDGET_KEYS.ALARM],
  alarm: [WIDGET_KEYS.ALARM, WIDGET_KEYS.TIMELINE],
  timeline: [WIDGET_KEYS.TIMELINE],
};

const MODE_STYLE = {
  standby: { label: 'mode_standby', color: WIDGET_COLORS.SUCCESS, icon: 'unlock' },
  home: { label: 'mode_home', color: WIDGET_COLORS.WARNING, icon: 'home' },
  away: { label: 'mode_away', color: WIDGET_COLORS.DANGER, icon: 'lock' },
};

// One action key per button (the core refuses two buttons with the same key).
export const ALARM_ACTIONS = { arm_away: 'away', arm_home: 'home', disarm: 'standby' };

const notConnected = () => ({
  ttl_seconds: 60,
  components: [{ type: 'text', text: t('widget_not_connected'), variant: 'body' }],
});

const truncate = (text, max) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

export const WIDGETS = {
  [WIDGET_KEYS.ALARM]: {
    async get(monitor, { settings = {} }) {
      if (!monitor.panel) {
        return notConnected();
      }
      const style = MODE_STYLE[monitor.mode] ?? {
        label: 'mode_unknown',
        color: WIDGET_COLORS.NEUTRAL,
        icon: 'help-circle',
      };
      const openCount = monitor.openings().filter(({ open }) => open).length;
      const faultCount = monitor.faultCount();
      const lastAlarm = monitor.lastAlarm;
      const lastAlarmText = lastAlarm
        ? truncate(String(lastAlarm.event_name ?? lastAlarm.event_type ?? ''), 40)
        : t('widget_none');

      const button = (key, label, icon, style = 'secondary') => ({
        type: 'button',
        label: t(label),
        icon,
        style,
        action: { key, confirm: true },
      });
      const buttons = [
        button('arm_away', 'widget_arm_away', 'lock', 'danger'),
        button('arm_home', 'widget_arm_home', 'home', 'primary'),
      ];
      if (settings.allow_disarm === true) {
        buttons.push(button('disarm', 'widget_disarm', 'unlock'));
      }

      return {
        // The monitor nudges the widget on every change it sees: the TTL is
        // only a safety net.
        ttl_seconds: 300,
        components: [
          {
            type: 'value',
            label: t('widget_mode'),
            value: t(style.label),
            icon: style.icon,
            color: style.color,
          },
          {
            type: 'value',
            label: t('widget_openings'),
            value: openCount,
            icon: 'log-in',
            color: openCount > 0 ? WIDGET_COLORS.WARNING : WIDGET_COLORS.SUCCESS,
          },
          {
            type: 'value',
            label: t('widget_faults'),
            value: faultCount,
            icon: 'alert-triangle',
            color: faultCount > 0 ? WIDGET_COLORS.WARNING : WIDGET_COLORS.SUCCESS,
          },
          {
            type: 'status',
            items: [
              {
                label: t('widget_connection'),
                icon: 'cloud',
                value: t(monitor.connected ? 'widget_online' : 'widget_offline'),
                color: monitor.connected ? WIDGET_COLORS.SUCCESS : WIDGET_COLORS.DANGER,
              },
              {
                label: t('widget_last_alarm'),
                icon: 'bell',
                value: lastAlarmText,
                color: lastAlarm ? WIDGET_COLORS.DANGER : WIDGET_COLORS.NEUTRAL,
              },
            ],
          },
          ...buttons,
        ],
      };
    },

    async action(monitor, { actionKey, settings = {} }) {
      logger.info(`onWidgetAction <- ${WIDGET_KEYS.ALARM}.${actionKey}`);
      const wanted = Object.hasOwn(ALARM_ACTIONS, actionKey) ? ALARM_ACTIONS[actionKey] : null;
      if (!wanted) {
        throw new Error(`Unknown widget action: ${actionKey}`);
      }
      // The setting may have been turned off since the content was rendered.
      if (wanted === 'standby' && settings.allow_disarm !== true) {
        return t('widget_disarm_disabled');
      }
      const mode = await monitor.setMode(wanted);
      return t('mode_set', { mode: t(`mode_${mode}`) });
    },
  },

  [WIDGET_KEYS.OPENINGS]: {
    async get(monitor) {
      if (!monitor.panel) {
        return notConnected();
      }
      // Open ones first: they are what the user looks for.
      const list = monitor
        .openings()
        .sort((a, b) => Number(b.open) - Number(a.open))
        .slice(0, 10);
      if (list.length === 0) {
        return {
          ttl_seconds: 300,
          components: [{ type: 'text', text: t('widget_no_openings'), variant: 'body' }],
        };
      }
      return {
        ttl_seconds: 120,
        components: [
          {
            type: 'status',
            items: list.map(({ device, open }) => ({
              label: truncate(String(device.name ?? device.id), 40),
              value: t(open ? 'state_open' : 'state_closed'),
              icon: open ? 'unlock' : 'lock',
              color: open ? WIDGET_COLORS.WARNING : WIDGET_COLORS.SUCCESS,
            })),
          },
        ],
      };
    },
  },

  [WIDGET_KEYS.TIMELINE]: {
    async get(monitor) {
      if (!monitor.panel) {
        return notConnected();
      }
      const events = monitor.recentEvents(8);
      if (events.length === 0) {
        return {
          ttl_seconds: 300,
          components: [{ type: 'text', text: t('widget_no_events'), variant: 'body' }],
        };
      }
      return {
        ttl_seconds: 120,
        components: [
          {
            type: 'card-list',
            display: 'list',
            items: events.map((event) => ({
              title: truncate(event.name, 60),
              ...(event.device ? { subtitle: truncate(event.device, 60) } : {}),
              ...(event.date ? { date: event.date } : {}),
              ...(event.alarm
                ? { badge: { text: t('badge_alarm'), color: WIDGET_COLORS.DANGER } }
                : {}),
            })),
          },
        ],
      };
    },
  },
};

/** Nudge every widget (after a (re)connection or a configuration change). */
export function refreshWidgets(gladys) {
  for (const key of Object.keys(WIDGETS)) {
    gladys.requestWidgetRefresh(key);
  }
}

/** Nudge the widgets showing what changed (`mode`, `openings`...). */
export function refreshChangedWidgets(gladys, changes) {
  const keys = new Set(changes.flatMap((change) => WIDGETS_BY_CHANGE[change] ?? []));
  for (const key of keys) {
    gladys.requestWidgetRefresh(key);
  }
}
