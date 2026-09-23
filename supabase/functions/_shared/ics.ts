/**
 * Minimal RFC 5545 (iCalendar) writer.
 *
 * An event is all-day unless it carries both a `startTime` and a `timeZone`, in
 * which case it becomes a timed event: the wall-clock time the admin typed is
 * resolved against the business timezone and written as a UTC stamp, which
 * every calendar app then renders back in the viewer's own zone. Writing UTC
 * rather than TZID avoids shipping a VTIMEZONE database, and is what the
 * booking mail has always done.
 *
 * Calendar apps are unforgiving about two things in particular — 75-octet line
 * folding and text escaping — and silently drop the whole file when either is
 * wrong, so both are handled here rather than at each call site.
 */

/** A job with a start but no usable end is given this much room on the calendar. */
export const DEFAULT_TIMED_DURATION_MINUTES = 120;

export interface IcsAlarm {
  /** RFC 5545 TRIGGER value relative to DTSTART, e.g. '-PT15H' or 'PT7H'. */
  trigger: string;
  description: string;
}

export interface IcsEvent {
  /** Stable across re-sends: same UID + higher SEQUENCE replaces the old entry. */
  uid: string;
  sequence: number;
  /** YYYY-MM-DD. */
  startDate: string;
  /** YYYY-MM-DD, exclusive. Defaults to the day after startDate. All-day events only. */
  endDate?: string;
  /** HH:MM[:SS] local to `timeZone`. Present with `timeZone` makes this a timed event. */
  startTime?: string | null;
  /** HH:MM[:SS] local to `timeZone`. Falls back to a default-length block. */
  endTime?: string | null;
  /** IANA zone the times are written in, e.g. 'America/Chicago'. */
  timeZone?: string | null;
  summary: string;
  description?: string;
  location?: string;
  url?: string;
  status?: 'CONFIRMED' | 'CANCELLED';
  alarms?: IcsAlarm[];
}

/** RFC 5545 §3.3.11: backslash, semicolon, comma and newlines are special in TEXT values. */
export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

/**
 * RFC 5545 §3.1 caps a content line at 75 octets, continued by CRLF + one space.
 * The limit counts bytes, so a multi-byte character must not be split across the
 * boundary — walk back off any UTF-8 continuation byte (high bits `10`) first.
 */
export function foldIcsLine(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;

  const decoder = new TextDecoder();
  const chunks: string[] = [];
  let start = 0;
  // The first line gets 75 octets; continuations get 74, since the leading space counts.
  let limit = 75;

  while (start < bytes.length) {
    let end = Math.min(start + limit, bytes.length);
    while (end > start && end < bytes.length && (bytes[end] & 0b1100_0000) === 0b1000_0000) {
      end--;
    }
    chunks.push(decoder.decode(bytes.subarray(start, end)));
    start = end;
    limit = 74;
  }

  return chunks.join('\r\n ');
}

function line(name: string, value: string): string {
  return foldIcsLine(`${name}:${value}`);
}

/** YYYY-MM-DD -> YYYYMMDD, the VALUE=DATE form used for all-day events. */
export function toIcsDate(date: string): string {
  return date.slice(0, 10).replace(/-/g, '');
}

/** UTC timestamp form: YYYYMMDDTHHMMSSZ. */
export function toIcsTimestamp(when: Date): string {
  return `${when.toISOString().slice(0, 19).replace(/[-:]/g, '')}Z`;
}

/** Shifts a YYYY-MM-DD date by whole days without letting a local timezone shift it. */
export function addDays(date: string, days: number): string {
  const [year, month, day] = date.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/**
 * Milliseconds a zone is ahead of UTC at a given instant. Formatting the
 * instant *in* the zone and reading the wall clock back is the only way to get
 * this without shipping a timezone database.
 */
export function zoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant);

  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? '0');
  const hour = get('hour') === 24 ? 0 : get('hour');

  return (
    Date.UTC(get('year'), get('month') - 1, get('day'), hour, get('minute'), get('second')) -
    instant.getTime()
  );
}

/**
 * '2026-09-26' + '11:30' in America/Chicago -> the matching UTC instant.
 * The offset is resolved twice because the first guess can land on the wrong
 * side of a DST change, which would put the job an hour out.
 */
export function zonedToUtc(date: string, time: string, timeZone: string): Date {
  const [year, month, day] = date.slice(0, 10).split('-').map(Number);
  const [hour, minute] = time.slice(0, 5).split(':').map(Number);
  const wallClock = Date.UTC(year, month - 1, day, hour, minute, 0);

  let instant = new Date(wallClock - zoneOffsetMs(new Date(wallClock), timeZone));
  instant = new Date(wallClock - zoneOffsetMs(instant, timeZone));

  return instant;
}

/** UTC instant -> YYYYMMDDTHHMMSSZ, the form a timed DTSTART/DTEND takes. */
export function toIcsUtcStamp(instant: Date): string {
  return `${instant.toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`;
}

/** HH:MM[:SS] -> minutes past midnight, or null when unparseable. */
function timeToMinutes(time: string): number | null {
  const match = /^(\d{1,2}):(\d{2})/.exec(time.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/**
 * The DTSTART/DTEND pair for a timed event, or null when the event has no
 * usable start time and should stay all-day.
 *
 * An end that is missing, unparseable, or not after the start gets the default
 * block length instead: the rest of the app reads these columns as plain
 * minutes-past-midnight with no wrap past midnight, and a DTEND at or before
 * DTSTART is rejected outright by calendar apps.
 */
export function resolveTimedRange(event: IcsEvent): { start: Date; end: Date } | null {
  if (!event.startTime || !event.timeZone) return null;

  const startMinutes = timeToMinutes(event.startTime);
  if (startMinutes === null) return null;

  const start = zonedToUtc(event.startDate, event.startTime, event.timeZone);

  const endMinutes = event.endTime ? timeToMinutes(event.endTime) : null;
  if (endMinutes !== null && endMinutes > startMinutes) {
    return { start, end: zonedToUtc(event.startDate, event.endTime!, event.timeZone) };
  }

  return { start, end: new Date(start.getTime() + DEFAULT_TIMED_DURATION_MINUTES * 60_000) };
}

function buildVEvent(event: IcsEvent, stamp: string): string[] {
  const timed = resolveTimedRange(event);

  const lines = [
    'BEGIN:VEVENT',
    line('UID', event.uid),
    line('SEQUENCE', String(event.sequence)),
    line('DTSTAMP', stamp),
  ];

  if (timed) {
    lines.push(
      line('DTSTART', toIcsUtcStamp(timed.start)),
      line('DTEND', toIcsUtcStamp(timed.end)),
    );
  } else {
    lines.push(
      line('DTSTART;VALUE=DATE', toIcsDate(event.startDate)),
      // DTEND is exclusive for all-day events, so a one-day job ends the next day.
      line('DTEND;VALUE=DATE', toIcsDate(event.endDate ?? addDays(event.startDate, 1))),
    );
  }

  lines.push(
    line('SUMMARY', escapeIcsText(event.summary)),
    line('STATUS', event.status ?? 'CONFIRMED'),
    // A job with real hours should read as busy; an all-day one stays free so a
    // day with a job on it is not greyed out end to end.
    line('TRANSP', timed ? 'OPAQUE' : 'TRANSPARENT'),
  );

  if (event.description) lines.push(line('DESCRIPTION', escapeIcsText(event.description)));
  if (event.location) lines.push(line('LOCATION', escapeIcsText(event.location)));
  // URL takes a URI value, which is not TEXT and must not be escaped.
  if (event.url) lines.push(line('URL', event.url));

  for (const alarm of event.alarms ?? []) {
    lines.push(
      'BEGIN:VALARM',
      line('ACTION', 'DISPLAY'),
      line('TRIGGER;RELATED=START', alarm.trigger),
      line('DESCRIPTION', escapeIcsText(alarm.description)),
      'END:VALARM',
    );
  }

  lines.push('END:VEVENT');
  return lines;
}

export interface BuildCalendarOptions {
  /** PUBLISH for a plain event to file; there are no attendees to RSVP here. */
  method?: 'PUBLISH' | 'CANCEL';
  /** Shown as the calendar name when the feed is subscribed to. */
  name?: string;
}

export function buildIcsCalendar(events: IcsEvent[], options: BuildCalendarOptions = {}): string {
  const stamp = toIcsTimestamp(new Date());
  const lines = [
    'BEGIN:VCALENDAR',
    line('VERSION', '2.0'),
    line('PRODID', '-//Boxed2Built//Job Schedule//EN'),
    line('CALSCALE', 'GREGORIAN'),
    line('METHOD', options.method ?? 'PUBLISH'),
  ];

  if (options.name) {
    // X-WR-CALNAME is non-standard but it is what Google and Apple actually read.
    lines.push(line('X-WR-CALNAME', escapeIcsText(options.name)));
    lines.push(line('NAME', escapeIcsText(options.name)));
    // Ask subscribers to re-poll hourly instead of using their slower default.
    lines.push(line('REFRESH-INTERVAL;VALUE=DURATION', 'PT1H'));
    lines.push(line('X-PUBLISHED-TTL', 'PT1H'));
  }

  for (const event of events) lines.push(...buildVEvent(event, stamp));

  lines.push('END:VCALENDAR');
  // RFC 5545 requires CRLF line endings, and a trailing one to close the last line.
  return `${lines.join('\r\n')}\r\n`;
}

/** Base64 for a Resend attachment. btoa() is byte-wise, so encode UTF-8 first. */
export function icsToBase64(ics: string): string {
  const bytes = new TextEncoder().encode(ics);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
