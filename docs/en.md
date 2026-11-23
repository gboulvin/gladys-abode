# Abode

Control your [Abode](https://goabode.com) security system from Gladys
Assistant: arm and disarm the alarm, follow the doors, windows and sensors,
drive locks, lights, switches and garage doors, take camera snapshots, and
react to alarms in your scenes.

## Requirements

- Gladys Assistant 5.1 or later.
- An Abode account (Abode Iota, Abode Security Kit / Gateway).
- **Two-factor authentication turned off for the account Gladys uses.** The
  integration signs in on its own, without anyone to type a code. If your
  main account uses two-factor authentication, invite a second user from the
  Abode app (Account → Users) and give its credentials to Gladys.

Abode only offers a **cloud** API: Gladys talks to `my.goabode.com`, so the
integration needs Internet access. Every device shows the **Cloud** badge.

## Configuration

1. Open the **Configuration** tab of the integration.
2. Enter the **email** and **password** of the Abode account.
3. Optionally change the **refresh interval** (15 seconds by default, from 10
   to 300): how often Gladys reads the alarm mode, the sensors and the
   alarms.
4. Save, then click **Test the connection**: it shows the number of devices
   found and the current alarm mode.
5. Open the **Discovery** tab and add the devices you want.

## Devices

| Abode device                 | In Gladys                                  |
| ---------------------------- | ------------------------------------------ |
| Gateway / panel              | **Alarm mode** select: Standby, Home, Away |
| Door / window contact        | Opening sensor (closed / open)             |
| Motion sensor                | Motion sensor                              |
| Water leak sensor            | Leak sensor                                |
| Smoke / CO detector          | Smoke or carbon monoxide sensor            |
| Multi-sensor                 | Temperature, humidity and light level      |
| Door lock                    | Lock (lock / unlock)                       |
| Power switch, smart plug     | Switch                                     |
| Dimmer, bulb                 | Light (on / off + brightness)              |
| Water valve                  | Switch (valve open)                        |
| Garage door (secure barrier) | Open / close command + opening sensor      |
| Cameras                      | Camera (snapshot on demand)                |
| Battery and tamper faults    | Low battery and tamper sensors             |

A device added in the Abode app shows up in the Discovery tab at the next
refresh.

## Actions (Configuration screen)

- **Test the connection** — reads Abode now and shows what was found.
- **List the automations** — the names of your Abode automations, to use in
  the "Run an Abode automation" scene action.
- **Change the alarm mode** — arm or disarm from the Configuration screen.

## Scenes

Triggers:

- **Abode alarm mode changed** — the alarm was armed or disarmed, from
  Gladys, a keypad, a key fob or the Abode app. Filter on the new mode;
  variables `{{triggerEvent.data.mode}}` and
  `{{triggerEvent.data.previous_mode}}` (`standby`, `home`, `away`).
- **Abode alarm triggered** — Abode raised an alarm. Filter on the type
  (intrusion, fire / smoke, carbon monoxide, water leak, panic, medical,
  other) and on the device; variables `alarm_type`, `device_name` and
  `event_name`.
- **Abode device fault** — a device reports a low battery, tampering, a jam
  or a lost connection. Variables `fault` and `device_name`.

Actions:

- **Set the Abode alarm mode** — returns the mode Abode confirmed.
- **Run an Abode automation** — by name (case-insensitive) or identifier;
  returns whether it was found and run.
- **Take an Abode camera snapshot** — then send it with the core action
  "Send a camera image".

Example: _when the alarm is triggered (intrusion), take a snapshot of the
garden camera, send it to me and turn on every light._

The standard Gladys triggers work too: "a door opens", "the temperature goes
above"...

## Dashboard

Three widgets are available (Gladys 5.1 or later):

- **Abode alarm** — the alarm mode, the number of open doors and windows,
  the devices in fault, the last alarm, and **Arm away** / **Arm home**
  buttons (with a confirmation). The **Disarm** button is hidden by default:
  turn on _Show the disarm button_ in the widget settings only if the
  dashboard is not visible to people who should not disarm the alarm.
- **Abode doors and windows** — the open / closed state of every opening
  sensor, open ones first.
- **Abode timeline** — the latest events, alarms highlighted.

The alarm mode select of the panel device can also be placed on a dashboard
with the standard device widget.

## Troubleshooting

- **"Abode sign-in failed"** — check the email and password in the Abode
  app. After a refused sign-in the integration waits 30 minutes before trying
  again (repeated failures can lock the account); saving the configuration
  retries at once.
- **"two-factor authentication"** — use an Abode user without two-factor
  authentication (see Requirements).
- **The cloud cannot be reached** — the devices show the _Unreachable_
  badge until the next successful read.
- Camera snapshots larger than Gladys accepts (150 KB) are downscaled
  automatically.

The integration logs every request it makes (never the password nor the
tokens): see the integration logs in Gladys, with `LOG_LEVEL=debug` for the
full detail.

Abode is a trademark of its owner; this integration is a community project,
not affiliated with Abode Systems.
