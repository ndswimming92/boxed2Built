import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateFinishedJobTimes } from '../../src/utils/jobCalculations.ts';

const job = { date_scheduled: '2026-10-26', scheduled_start_time: '18:00:00' };

test('stamps end time, local date and hours rounded to 0.1', () => {
  const now = new Date(2026, 9, 26, 18, 32);
  assert.deepEqual(calculateFinishedJobTimes(job, now), {
    actual_end_time: '18:32',
    date_completed: '2026-10-26',
    hours_worked: 0.5,
  });
});

test('never returns fewer than 0.1 hours', () => {
  const now = new Date(2026, 9, 26, 18, 1);
  assert.equal((calculateFinishedJobTimes(job, now) as any).hours_worked, 0.1);
});

test('errors without a start time or before the start', () => {
  assert.ok('error' in calculateFinishedJobTimes({ ...job, scheduled_start_time: null }));
  assert.ok('error' in calculateFinishedJobTimes(job, new Date(2026, 9, 26, 17, 0)));
});

test('errors when the finish falls on a different day than scheduled', () => {
  const overnight = { date_scheduled: '2026-10-26', scheduled_start_time: '23:00' };
  assert.ok('error' in calculateFinishedJobTimes(overnight, new Date(2026, 9, 27, 1, 0)));
  assert.ok('error' in calculateFinishedJobTimes(job, new Date(2026, 9, 28, 9, 0)));
});
