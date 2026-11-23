# Abode for Gladys Assistant

External integration for [Gladys Assistant](https://gladysassistant.com) that
connects an [Abode](https://goabode.com) security system: alarm modes, door,
window, motion, leak, smoke and multi-sensors, locks, lights, switches, water
valves, garage doors and cameras — with scene triggers, scene actions and
dashboard widgets.

Built on the official
[JavaScript integration template](https://github.com/GladysAssistant/integration-template-js)
and [`@gladysassistant/integration-sdk`](https://github.com/GladysAssistant/integration-sdk-js).

- **Transport: cloud.** Abode has no local API; the integration talks to
  `my.goabode.com` and every device carries the _Cloud_ badge
  (manifest `"transports": ["cloud"]`).
- **Languages:** English, French, German and Spanish — manifest texts,
  messages, widgets and documentation ([en](docs/en.md), [fr](docs/fr.md),
  [de](docs/de.md), [es](docs/es.md)).
- **Requires Gladys ≥ 5.1.0** (scene triggers, scene actions and widgets).

## Features

| Surface        | What                                                                                                                                                                        |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Devices        | Panel alarm mode (select), openings, motion, leak, smoke, CO, temperature, humidity, light, locks, switches, dimmers, valves, garage doors, cameras, low battery and tamper |
| Scene triggers | `mode_changed`, `alarm_triggered` (intrusion, fire, CO, water, panic, medical), `device_fault`                                                                              |
| Scene actions  | `set_mode`, `trigger_automation`, `capture_image`                                                                                                                           |
| Widgets        | `abode_alarm` (mode, openings, faults, last alarm, arm buttons), `abode_openings`, `abode_timeline`                                                                         |
| Config actions | `test_connection`, `list_automations`, `set_mode`                                                                                                                           |

The user documentation, shown by Gladys from the Configuration screen, is in
[`docs/`](docs/en.md).

## How it works

```
index.js                SDK wiring only
src/abode/client.js     Abode cloud client (login, session renewal, endpoints)
src/abode/devices.js    Abode JSON -> Gladys devices/states, commands back (pure)
src/abode/events.js     timeline events, Contact ID alarm classification
src/abode/monitor.js    polling loop: publishes devices/states, fires triggers
src/abode/image.js      camera snapshots downscaled under the 150 KB limit
src/abode/storage.js    stable client uuid under /data
src/actions.js          Configuration screen buttons
src/scenes.js           scene actions
src/widgets.js          dashboard widgets
src/i18n.js             every message in en / fr / de / es
```

The monitor reads the panel, the devices and the timeline every
`refresh_interval` seconds (15 by default), publishes only the states that
changed (`publishChangedStates`), and fires the scene triggers on transitions
only — never on the first read. Gladys' own device poll (at most once a
minute) is not used: too slow for an alarm.

The Abode endpoints are the ones the Abode web app uses, as documented by the
community clients (abodepy / jaraco.abode, behind the Home Assistant
integration). Accounts with two-factor authentication are not supported:
use a dedicated Abode user.

## Development

```bash
npm install
npm test               # node --test, never touches the network
npm run lint
npm run format:check
```

Run it against a local Gladys:

```bash
GLADYS_HOST_API_URL="http://localhost:1443" \
GLADYS_INTEGRATION_TOKEN="<token>" \
GLADYS_INTEGRATION_SELECTOR="abode" \
GLADYS_ABODE_DATA_DIR="./data" \
LOG_LEVEL=debug \
npm start
```

Check the store rules before releasing:

```bash
npx github:GladysAssistant/integration-store .
```

## Release

Describe the changes under `## [Unreleased]` in [`CHANGELOG.md`](CHANGELOG.md),
then run **Actions → Release → Run workflow** (`patch`, `minor` or `major`).
The workflow bumps the versions, tags, builds the multi-arch image to
`ghcr.io/gboulvin/gladys-abode` and publishes the GitHub Release. The GHCR
package must be **public** for Gladys to pull it, and the repository needs
the `gladys-assistant-integration` topic to be indexed by the store.

## License

Apache-2.0. Abode is a trademark of its owner; this is a community project,
not affiliated with Abode Systems.
