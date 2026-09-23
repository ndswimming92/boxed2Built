import test from 'node:test';
import assert from 'node:assert/strict';

import { icsLeadTrigger } from '../../supabase/functions/_shared/ics.ts';
import {
  formatDurationMinutes,
  formatLeaveByLabel,
  formatLeaveByTime,
} from '../../supabase/functions/_shared/scheduleLabels.ts';
import {
  computeLeaveBy,
  normalizeBufferMinutes,
  travelMinutes,
} from '../../supabase/functions/_shared/travel.ts';

const MINUTES = 60;

test('leave-by is the start less the drive less the buffer', () => {
  // 11:30 start, 45 minute drive, 15 minute buffer -> 10:30.
  const leaveBy = computeLeaveBy('11:30:00', 45 * MINUTES, 15);

  assert.ok(leaveBy);
  assert.equal(leaveBy.time, '10:30');
  assert.equal(leaveBy.daysEarlier, 0);
  assert.equal(leaveBy.driveMinutes, 45);
  assert.equal(leaveBy.bufferMinutes, 15);
  assert.equal(leaveBy.leadMinutes, 60);
});

test('a zero buffer leaves exactly the drive time', () => {
  const leaveBy = computeLeaveBy('09:00', 20 * MINUTES, 0);

  assert.equal(leaveBy?.time, '08:40');
  assert.equal(leaveBy?.leadMinutes, 20);
});

test('drive seconds round to the minute the card already shows', () => {
  // 44:40 displays as "45 min", so the leave-by has to count back 45, not 44.
  assert.equal(travelMinutes(2680), 45);
  assert.equal(computeLeaveBy('11:30', 2680, 0)?.time, '10:45');

  // Anything non-zero is at least a minute, matching formatTravelDuration().
  assert.equal(travelMinutes(20), 1);
  assert.equal(travelMinutes(0), 0);
  assert.equal(travelMinutes(null), 0);
});

test('a lead time that crosses midnight reports the day before', () => {
  // 7:00am start, 8 hour drive, 15 minute buffer -> 10:45pm the previous night.
  const leaveBy = computeLeaveBy('07:00', 8 * 60 * MINUTES, 15);

  assert.equal(leaveBy?.time, '22:45');
  assert.equal(leaveBy?.daysEarlier, 1);
  assert.equal(formatLeaveByTime(leaveBy!), '10:45 PM the day before');
});

test('a lead time longer than a day keeps counting days back', () => {
  // 30 hours back from 9:00am lands at 3:00am the previous day, not two days out.
  const oneDay = computeLeaveBy('09:00', 30 * 60 * MINUTES, 0);
  assert.equal(oneDay?.time, '03:00');
  assert.equal(oneDay?.daysEarlier, 1);

  const twoDays = computeLeaveBy('09:00', 48 * 60 * MINUTES, 0);
  assert.equal(twoDays?.time, '09:00');
  assert.equal(twoDays?.daysEarlier, 2);
  assert.equal(formatLeaveByTime(twoDays!), '9:00 AM, 2 days before');
});

test('leaving exactly at midnight stays on the job\'s own day', () => {
  // A lead that lands on 00:00 is still the same morning, not the day before.
  const leaveBy = computeLeaveBy('01:00', 60 * MINUTES, 0);

  assert.equal(leaveBy?.time, '00:00');
  assert.equal(leaveBy?.daysEarlier, 0);
});

test('an all-day job has no leave-by', () => {
  // No start hour means DTSTART is local midnight, and counting back from it
  // would invent a departure the job never implied.
  assert.equal(computeLeaveBy(null, 45 * MINUTES, 15), null);
  assert.equal(computeLeaveBy('', 45 * MINUTES, 15), null);
  assert.equal(computeLeaveBy('not a time', 45 * MINUTES, 15), null);
  assert.equal(computeLeaveBy('99:99', 45 * MINUTES, 15), null);
});

test('a missing drive time has no leave-by', () => {
  assert.equal(computeLeaveBy('11:30', null, 15), null);
  assert.equal(computeLeaveBy('11:30', undefined, 15), null);
  assert.equal(computeLeaveBy('11:30', -1, 15), null);
});

test('a buffer outside the stored range falls back or clamps', () => {
  assert.equal(normalizeBufferMinutes(undefined), 15);
  assert.equal(normalizeBufferMinutes(null), 15);
  assert.equal(normalizeBufferMinutes('nonsense'), 15);
  assert.equal(normalizeBufferMinutes(-5), 15);
  assert.equal(normalizeBufferMinutes(0), 0);
  assert.equal(normalizeBufferMinutes(10_000), 240);
  assert.equal(normalizeBufferMinutes('30'), 30);
});

test('the lead time becomes a valid RFC 5545 negative trigger', () => {
  assert.equal(icsLeadTrigger(45), '-PT45M');
  assert.equal(icsLeadTrigger(60), '-PT1H');
  assert.equal(icsLeadTrigger(75), '-PT1H15M');
  assert.equal(icsLeadTrigger(0), '-PT0M');
  // A whole number of days must not emit a dangling 'T'.
  assert.equal(icsLeadTrigger(24 * 60), '-P1D');
  assert.equal(icsLeadTrigger(25 * 60), '-P1DT1H');
  assert.equal(icsLeadTrigger(24 * 60 + 5), '-P1DT5M');
  // Fractional minutes come from rounding a duration, never from a column.
  assert.equal(icsLeadTrigger(44.6), '-PT45M');
});

test('the label carries the parts it was built from', () => {
  const leaveBy = computeLeaveBy('11:30', 45 * MINUTES, 15)!;
  assert.equal(formatLeaveByLabel(leaveBy), '10:30 AM (45 min drive + 15 min buffer)');

  const noBuffer = computeLeaveBy('11:30', 45 * MINUTES, 0)!;
  assert.equal(formatLeaveByLabel(noBuffer), '10:45 AM (45 min drive)');

  const longDrive = computeLeaveBy('16:00', 72 * MINUTES, 20)!;
  assert.equal(formatLeaveByLabel(longDrive), '2:28 PM (1 hr 12 min drive + 20 min buffer)');
});

test('durations read the way the drive-time card reads them', () => {
  assert.equal(formatDurationMinutes(0), '0 min');
  assert.equal(formatDurationMinutes(45), '45 min');
  assert.equal(formatDurationMinutes(60), '1 hr');
  assert.equal(formatDurationMinutes(72), '1 hr 12 min');
  assert.equal(formatDurationMinutes(120), '2 hr');
});
