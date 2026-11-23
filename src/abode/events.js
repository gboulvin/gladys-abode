// -----------------------------------------------------------------------------
// Abode timeline events.
//
// The Abode timeline (`/api/v1/timeline`) lists what happened on the system:
// arming, sensors, alarms... Alarm events carry a Contact ID code: a 4-digit
// string whose first digit is the qualifier (1 = new event, 3 = restore) and
// whose last three digits name the event, 100-199 being the alarms (100
// medical, 110 fire, 120 panic, 130 burglary, 154 water leak, 162 carbon
// monoxide...).
// -----------------------------------------------------------------------------

export const ALARM_TYPES = ['burglary', 'fire', 'panic', 'medical', 'co', 'water', 'other'];

/** Alarm type of a timeline event, null when the event is not a new alarm. */
export function alarmType(event) {
  const code = String(event?.event_code ?? '');
  const match = code.match(/^1(1\d\d)$/);
  if (match) {
    return alarmTypeFromCode(Number(match[1]));
  }
  // Events without a Contact ID code: rely on the event type and name.
  const type = String(event?.event_type ?? '');
  const name = String(event?.event_name ?? '');
  if (!/alarm/i.test(type) || /cancel|restor|clear|test/i.test(`${type} ${name}`)) {
    return null;
  }
  return alarmTypeFromName(name);
}

function alarmTypeFromCode(code) {
  if (code === 154) return 'water';
  if (code === 162) return 'co';
  if (code < 110) return 'medical';
  if (code < 120) return 'fire';
  if (code < 130) return 'panic';
  if (code < 140) return 'burglary';
  return 'other';
}

function alarmTypeFromName(name) {
  if (/monoxide|\bco\b/i.test(name)) return 'co';
  if (/smoke|fire|heat/i.test(name)) return 'fire';
  if (/water|leak|flood/i.test(name)) return 'water';
  if (/panic/i.test(name)) return 'panic';
  if (/medical|emergency/i.test(name)) return 'medical';
  if (/burglar|intrusion|door|window|motion/i.test(name)) return 'burglary';
  return 'other';
}

/** Identifier of a timeline event (its id, or its content as a last resort). */
export function eventId(event) {
  if (event?.id !== undefined && event?.id !== null) {
    return String(event.id);
  }
  return [event?.event_utc, event?.event_code, event?.device_id, event?.event_name].join('|');
}

/** Date of a timeline event as an ISO string, null when unknown. */
export function eventDate(event) {
  const utc = Number(event?.event_utc);
  if (Number.isFinite(utc) && utc > 0) {
    // Abode sends seconds; tolerate milliseconds.
    return new Date(utc < 1e12 ? utc * 1000 : utc).toISOString();
  }
  return null;
}
