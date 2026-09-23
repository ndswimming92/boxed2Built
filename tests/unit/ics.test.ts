import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_TIMED_DURATION_MINUTES,
  buildIcsCalendar,
  resolveTimedRange,
  zonedToUtc,
  type IcsEvent,
} from '../../supabase/functions/_shared/ics.ts';

const CHICAGO = 'America/Chicago';

function event(overrides: Partial<IcsEvent> = {}): IcsEvent {
  return {
    uid: 'job-1@boxed2built.com',
    sequence: 0,
    startDate: '2026-09-26',
    summary: 'Assembly — Dana Reyes',
    ...overrides,
  };
}

/** The VEVENT property lines, unfolded, so assertions can look one up by name. */
function properties(ics: string): Map<string, string> {
  const unfolded = ics.replace(/\r\n /g, '');
  const map = new Map<string, string>();
  for (const line of unfolded.split('\r\n')) {
    const at = line.indexOf(':');
    if (at === -1) continue;
    map.set(line.slice(0, at), line.slice(at + 1));
  }
  return map;
}

test('a job with no start time stays an all-day event', () => {
  const props = properties(buildIcsCalendar([event()]));

  assert.equal(props.get('DTSTART;VALUE=DATE'), '20260926');
  assert.equal(props.get('DTEND;VALUE=DATE'), '20260927');
  assert.equal(props.get('TRANSP'), 'TRANSPARENT');
  assert.equal(props.has('DTSTART'), false);
});

test('a start and end time become a timed event in the business timezone', () => {
  const props = properties(
    buildIcsCalendar([
      event({ startTime: '11:30:00', endTime: '16:00:00', timeZone: CHICAGO }),
    ]),
  );

  // Late September is CDT, UTC-5: 11:30 local is 16:30Z, 16:00 local is 21:00Z.
  assert.equal(props.get('DTSTART'), '20260926T163000Z');
  assert.equal(props.get('DTEND'), '20260926T210000Z');
  // A job with real hours should read as busy, not free.
  assert.equal(props.get('TRANSP'), 'OPAQUE');
  assert.equal(props.has('DTSTART;VALUE=DATE'), false);
});

test('the wall-clock time survives a daylight saving change', () => {
  const summer = properties(
    buildIcsCalendar([event({ startDate: '2026-07-15', startTime: '09:00', timeZone: CHICAGO })]),
  );
  const winter = properties(
    buildIcsCalendar([event({ startDate: '2026-12-15', startTime: '09:00', timeZone: CHICAGO })]),
  );

  // Same 9am on the clock, an hour apart in UTC — CDT in July, CST in December.
  assert.equal(summer.get('DTSTART'), '20260715T140000Z');
  assert.equal(winter.get('DTSTART'), '20261215T150000Z');
});

test('a missing end time gets a default-length block', () => {
  const range = resolveTimedRange(event({ startTime: '11:30', timeZone: CHICAGO }))!;

  assert.notEqual(range, null);
  assert.equal(
    range.end.getTime() - range.start.getTime(),
    DEFAULT_TIMED_DURATION_MINUTES * 60_000,
  );
});

test('an end time at or before the start falls back rather than writing an invalid range', () => {
  for (const endTime of ['11:30', '09:00']) {
    const range = resolveTimedRange(event({ startTime: '11:30', endTime, timeZone: CHICAGO }))!;
    assert.ok(range.end > range.start, `expected a positive range for end ${endTime}`);
    assert.equal(
      range.end.getTime() - range.start.getTime(),
      DEFAULT_TIMED_DURATION_MINUTES * 60_000,
    );
  }
});

test('a time with no timezone, or an unparseable one, stays all-day', () => {
  assert.equal(resolveTimedRange(event({ startTime: '11:30' })), null);
  assert.equal(resolveTimedRange(event({ startTime: 'not a time', timeZone: CHICAGO })), null);
  assert.equal(resolveTimedRange(event({ startTime: '', timeZone: CHICAGO })), null);
});

test('zonedToUtc resolves the offset from the target instant, not the guess', () => {
  // 2026-03-08 is the US spring-forward day: 1:00am CST is 07:00Z, and 3:00am
  // CDT — an hour later on the clock face than 2am, which does not exist — is 08:00Z.
  assert.equal(zonedToUtc('2026-03-08', '01:00', CHICAGO).toISOString(), '2026-03-08T07:00:00.000Z');
  assert.equal(zonedToUtc('2026-03-08', '03:00', CHICAGO).toISOString(), '2026-03-08T08:00:00.000Z');
});

test('the calendar still folds long lines and escapes TEXT values', () => {
  const ics = buildIcsCalendar([
    event({
      startTime: '11:30',
      timeZone: CHICAGO,
      location: '1234 Very Long Street Name, Suite 500, Some Quite Long City Name, TX 75001',
      description: 'Semi; colon, comma\nand a newline',
    }),
  ]);

  assert.ok(ics.includes('\r\n '), 'expected at least one folded continuation line');
  for (const line of ics.split('\r\n')) {
    assert.ok(
      new TextEncoder().encode(line).length <= 75,
      `line over 75 octets: ${line.slice(0, 40)}…`,
    );
  }

  const props = properties(ics);
  assert.equal(props.get('DESCRIPTION'), 'Semi\\; colon\\, comma\\nand a newline');
});
