# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [semantic versioning](https://semver.org/).

Describe each change under `## [Unreleased]` as you make it. The Release
workflow moves that section under the version it ships, and the section becomes
the notes of the version's GitHub Release.

## [Unreleased]

### Added

- Abode integration for Gladys Assistant 5.1 or later, over the Abode cloud.
- Devices: the alarm mode of the panel (standby, home, away), door and window
  contacts, motion, water leak, smoke and carbon monoxide sensors,
  temperature, humidity and light levels, locks, switches, dimmers, water
  valves, garage doors, cameras, and the low battery and tamper faults.
- Scene triggers: alarm mode changed, alarm triggered (intrusion, fire, carbon
  monoxide, water leak, panic, medical) and device fault.
- Scene actions: set the alarm mode, run an Abode automation, take a camera
  snapshot.
- Dashboard widgets: alarm (mode, open doors and windows, faults, last alarm,
  arm buttons, optional disarm button), doors and windows, timeline.
- Configuration actions: test the connection, list the automations, change
  the alarm mode.
- English, French, German and Spanish texts and documentation.

[Unreleased]: https://github.com/gboulvin/gladys-abode/commits/main
