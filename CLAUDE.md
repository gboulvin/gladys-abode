# CLAUDE.md

Project rules for coding assistants (Claude Code reads this file) and for human
contributors.

## What this is

A Gladys Assistant **external integration** for the **Abode** security system:
a Node.js service (Node 22+, ESM, no build step) that runs in its own sandboxed
Docker container and talks to Gladys through
[`@gladysassistant/integration-sdk`](https://github.com/GladysAssistant/integration-sdk-js),
and to Abode through its **cloud** API (`https://my.goabode.com`, no local
API). Runtime dependencies: the SDK and `jpeg-js` (pure-JS camera image
downscaling). It started from the official JavaScript template.

## Commands

```bash
npm install
npm test                                  # node --test, the built-in runner
node --test test/monitor.test.js          # one file
node --test --test-name-pattern "alarm"   # tests whose name matches
npm run lint                              # ESLint
npm run format:check                      # Prettier, as the CI runs it
npm run format                            # Prettier, fix in place
npx github:GladysAssistant/integration-store .   # store admission checks
```

The CI (`.github/workflows/ci.yml`) runs `format:check`, `lint` and `test` on
Node 22 and 24, and builds the Docker image: run the three commands before
pushing.

## Architecture

```
index.js                          SDK wiring only: handlers registered before connect()
src/abode/client.js               Abode cloud client: login, session renewal, endpoints
src/abode/devices.js              pure mapping Abode JSON <-> Gladys devices, states, commands
src/abode/events.js               timeline events, Contact ID alarm classification
src/abode/monitor.js              polling loop, change detection, scene triggers, commands
src/abode/image.js                camera snapshots downscaled under 150 KB
src/abode/storage.js              stable client uuid under /data
src/actions.js                    Configuration screen buttons (manifest `actions`)
src/scenes.js                     scene action handlers (manifest `scene_actions`)
src/widgets.js                    dashboard widgets (manifest `widgets`)
src/i18n.js                       every user-facing message, en / fr / de / es
src/config.js                     DEFAULT_CONFIG (mirrors the manifest defaults) + normalization
gladys-assistant-integration.json manifest
docs/{en,fr,de,es}.md             user documentation, re-hosted by Gladys (mandatory)
test/                             node --test, fake Gladys of the SDK + FakeAbodeClient (test/fixtures.js)
.github/scripts/release.mjs       release helpers (manifest bump, changelog), tested in test/
```

## Rules

- **External ids are forever.** Devices are `gladys.externalIds('device',
platformId(abodeId))` (`ZB:00a1` -> `zb-00a1`) and the panel
  `externalIds('panel', platformId(mac))`; feature keys are the `FEATURE`
  constants of `src/abode/devices.js`. Never derive one from a name, never
  rename one. The same goes for manifest keys: `config_schema`, `actions`,
  `scene_triggers`, `scene_actions`, `widgets`, widget button action keys,
  trigger filter option values (`alarm_type`, `fault`, `mode`).
- **Every feature carries `name`, `min`, `max`, `read_only` and
  `has_feedback`** (Gladys stores them NOT NULL; HTTP 422 on "Add" otherwise).
  `test/devices.test.js` checks them against the SDK's fake Gladys.
- **Transport is `cloud` only.** The manifest declares `"transports":
["cloud"]`; the monitor publishes `cloud` for every device, `unreachable`
  while Abode cannot be read. Do not add `local` without a real local channel.
- **Scene triggers fire on transitions only**, never on the first read (it
  sets the baseline), one event per change. `data` only carries keys declared
  in the trigger's `fields`/`variables` (tests check it). Never fire an event
  from inside a scene action handler.
- **Security.** Never log the password, tokens or cookies. Disarming from a
  widget stays opt-in (`allow_disarm` widget setting) and every alarm button
  keeps `confirm: true`. After refused credentials the monitor waits 30
  minutes before retrying (account lockout).
- **The container rootfs is read-only.** Write only under `/data`
  (`GLADYS_ABODE_DATA_DIR` overrides it for local runs).
- **Internationalization.** Every user-facing text exists in **English,
  French, German and Spanish**: manifest texts (`label`, `description`,
  `placeholder`, option labels — checked by `test/manifest.test.js`), runtime
  messages (only through `t()` of `src/i18n.js` — checked by
  `test/i18n.test.js`) and `docs/en.md`, `docs/fr.md`, `docs/de.md`,
  `docs/es.md`, kept in sync. Widget limits: value ≤ 12 chars, tile label ≤
  24, status label/value ≤ 40, button label ≤ 24.
- **Versions belong to the Release workflow** (Actions → Release). Never edit
  `version` in `package.json` or in the manifest, nor the `docker_image` tag,
  by hand. `test/manifest.test.js` checks they agree.
- **Changelog.** Every user-visible change adds a line under `## [Unreleased]`
  in `CHANGELOG.md` (`### Added`, `Changed`, `Fixed`, `Removed`, `Security`).
  Never write a version heading: the Release workflow moves the section.
- **Manifest.** Texts are multi-language objects, never plain strings. The
  catalog `description` holds 10 to 100 characters per language. Scene and
  widget fields require `gladys_version` `>=5.1.0`. `test/manifest.test.js`
  ties the manifest to the code (defaults, actions, scene and widget
  handlers, trigger options): change both sides together.
- **Style.** Prettier formats, ESLint catches mistakes. Comments explain why,
  in English. Tests never touch the network: use `FakeAbodeClient` or an
  injected `fetch`.
