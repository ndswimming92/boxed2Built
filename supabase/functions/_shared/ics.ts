/**
 * Minimal RFC 5545 (iCalendar) writer.
 *
 * Job dates carry no time of day, so every event here is all-day. Calendar apps
 * are unforgiving about two things in particular — 75-octet line folding and
 * text escaping — and silently drop the whole file when either is wrong, so both
 * are handled here rather than at each call site.
 */

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
  /** YYYY-MM-DD, exclusive. Defaults to the day after startDate. */
  endDate?: string;
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

function buildVEvent(event: IcsEvent, stamp: string): string[] {
  const lines = [
    'BEGIN:VEVENT',
    line('UID', event.uid),
    line('SEQUENCE', String(event.sequence)),
    line('DTSTAMP', stamp),
    line('DTSTART;VALUE=DATE', toIcsDate(event.startDate)),
    // DTEND is exclusive for all-day events, so a one-day job ends the next day.
    line('DTEND;VALUE=DATE', toIcsDate(event.endDate ?? addDays(event.startDate, 1))),
    line('SUMMARY', escapeIcsText(event.summary)),
    line('STATUS', event.status ?? 'CONFIRMED'),
    line('TRANSP', 'TRANSPARENT'),
  ];

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
