import test from 'node:test';
import assert from 'node:assert/strict';
import { findNextJob, formatTimeOfDay } from '../../src/utils/nextJob.ts';

const job = (over: Record<string, unknown>) =>
  ({ is_active: true, date_completed: null, job_status: 'scheduled', scheduled_start_time: null, ...over }) as never;

test('picks the soonest upcoming job, timed before untimed on the same day', () => {
  const now = new Date(2026, 9, 26, 9, 0);
  const jobs = [
    job({ id: 'late', date_scheduled: '2026-10-30' }),
    job({ id: 'untimed', date_scheduled: '2026-10-27' }),
    job({ id: 'timed', date_scheduled: '2026-10-27', scheduled_start_time: '10:00:00' }),
    job({ id: 'past', date_scheduled: '2026-10-20' }),
    job({ id: 'done', date_scheduled: '2026-10-26', job_status: 'completed' }),
    job({ id: 'cancelled', date_scheduled: '2026-10-26', job_status: 'cancelled' }),
  ];
  assert.equal((findNextJob(jobs, now) as { id: string }).id, 'timed');
});

test('returns null when nothing is coming up', () => {
  assert.equal(findNextJob([job({ id: 'x', date_scheduled: null })], new Date(2026, 9, 26)), null);
});

test('formats time of day', () => {
  assert.equal(formatTimeOfDay('14:30:00'), '2:30 PM');
  assert.equal(formatTimeOfDay('00:05:00'), '12:05 AM');
  assert.equal(formatTimeOfDay(null), null);
});
