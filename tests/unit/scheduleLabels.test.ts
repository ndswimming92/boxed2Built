import test from 'node:test';
import assert from 'node:assert/strict';

import {
  formatScheduleDate,
  formatScheduleTime,
  formatScheduleWhen,
  normalizeScheduleTime,
} from '../../supabase/functions/_shared/scheduleLabels.ts';

test('a date formats without slipping into the previous day', () => {
  assert.equal(formatScheduleDate('2026-09-26'), 'Saturday, September 26, 2026');
  assert.equal(formatScheduleDate('2026-01-01'), 'Thursday, January 1, 2026');
});

test('times normalize to HH:MM whichever shape the column hands back', () => {
  // Postgres returns 'HH:MM:SS'; the Jobs form sends 'HH:MM'. Both must compare equal.
  assert.equal(normalizeScheduleTime('11:30:00'), '11:30');
  assert.equal(normalizeScheduleTime('11:30'), '11:30');
  assert.equal(normalizeScheduleTime(null), null);
  assert.equal(normalizeScheduleTime(''), null);
  assert.equal(normalizeScheduleTime('   '), null);
  assert.equal(normalizeScheduleTime('not a time'), null);
  // Out of range is unreadable here exactly as it is to the ICS writer, so the
  // two modules never disagree about whether a job has usable hours.
  assert.equal(normalizeScheduleTime('24:00'), null);
  assert.equal(normalizeScheduleTime('11:75'), null);
  assert.equal(normalizeScheduleTime('9:05'), '09:05');
});

test('times read the way the admin typed them', () => {
  assert.equal(formatScheduleTime('11:30:00'), '11:30 AM');
  assert.equal(formatScheduleTime('16:00'), '4:00 PM');
  assert.equal(formatScheduleTime('00:15'), '12:15 AM');
  assert.equal(formatScheduleTime('12:00'), '12:00 PM');
  assert.equal(formatScheduleTime(null), null);
});

test('a job with no start time is described by its date alone', () => {
  assert.equal(formatScheduleWhen('2026-09-26', null, null), 'Saturday, September 26, 2026');
  assert.equal(formatScheduleWhen('2026-09-26', null, '16:00'), 'Saturday, September 26, 2026');
});

test('a job with hours is described by the range it occupies', () => {
  assert.equal(
    formatScheduleWhen('2026-09-26', '11:30:00', '16:00:00'),
    'Saturday, September 26, 2026, 11:30 AM – 4:00 PM',
  );
});

test('an end that is not after the start is left off rather than shown backwards', () => {
  const startOnly = 'Saturday, September 26, 2026, 11:30 AM';
  assert.equal(formatScheduleWhen('2026-09-26', '11:30', null), startOnly);
  assert.equal(formatScheduleWhen('2026-09-26', '11:30', '11:30'), startOnly);
  assert.equal(formatScheduleWhen('2026-09-26', '11:30', '09:00'), startOnly);
});
