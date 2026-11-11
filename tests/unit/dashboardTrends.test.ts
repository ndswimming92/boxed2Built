import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMonthlyTrend, summarizeMonthToDate } from '../../src/utils/dashboardTrends.ts';

const job = (over: Record<string, unknown>) =>
  ({ is_active: true, date_completed: null, final_price: null, hours_worked: null, ...over }) as never;

// Mid-November, mid-afternoon.
const NOW = new Date(2026, 10, 11, 15, 0);

test('the trend covers twelve months ending with the current one, quiet months included', () => {
  const trend = buildMonthlyTrend(
    [
      job({ date_completed: '2026-11-03', final_price: 200, hours_worked: 2 }),
      job({ date_completed: '2026-11-09', final_price: 150, hours_worked: 1.5 }),
      job({ date_completed: '2026-09-20', final_price: 300, hours_worked: 4 }),
    ],
    12,
    NOW,
  );

  assert.equal(trend.length, 12);
  assert.equal(trend[0].key, '2025-12');
  assert.equal(trend[11].key, '2026-11');
  assert.deepEqual(
    trend.filter(p => p.inProgress).map(p => p.key),
    ['2026-11'],
  );

  const november = trend[11];
  assert.equal(november.revenue, 350);
  assert.equal(november.jobs, 2);
  assert.equal(november.hours, 3.5);

  const october = trend[10];
  assert.equal(october.revenue, 0, 'a month with no work is kept as a zero, not dropped');
  assert.equal(october.jobs, 0);

  assert.equal(trend[9].revenue, 300);
});

test('the trend ignores unfinished jobs and anything older than the window', () => {
  const trend = buildMonthlyTrend(
    [
      job({ date_completed: null, final_price: 999 }),
      job({ date_completed: '2025-11-30', final_price: 500 }),
    ],
    12,
    NOW,
  );
  assert.equal(trend.reduce((sum, p) => sum + p.revenue, 0), 0);
});

test('a job completed on the first of the month lands in that month', () => {
  // A bare date parsed as UTC would slide back into October west of Greenwich.
  const trend = buildMonthlyTrend([job({ date_completed: '2026-11-01', final_price: 100 })], 12, NOW);
  assert.equal(trend[11].revenue, 100);
  assert.equal(trend[10].revenue, 0);
});

test('month to date is compared with the same days of last month, not the whole month', () => {
  const summary = summarizeMonthToDate(
    [
      job({ date_completed: '2026-11-05', final_price: 300, hours_worked: 3 }),
      // Inside the comparison window (Oct 1–11).
      job({ date_completed: '2026-10-11', final_price: 200, hours_worked: 2 }),
      // Later in October: a full-month comparison would count this and show a slump.
      job({ date_completed: '2026-10-25', final_price: 1000, hours_worked: 8 }),
    ],
    NOW,
  );

  assert.equal(summary.revenue.current, 300);
  assert.equal(summary.revenue.previous, 200);
  assert.equal(summary.revenue.percentChange, 50);
  assert.equal(summary.jobs.current, 1);
  assert.equal(summary.jobs.previous, 1);
  assert.equal(summary.jobs.percentChange, 0);
  assert.equal(summary.hours.current, 3);
});

test('no change is reported when last month has nothing to compare against', () => {
  const summary = summarizeMonthToDate([job({ date_completed: '2026-11-05', final_price: 300 })], NOW);
  assert.equal(summary.revenue.previous, 0);
  assert.equal(summary.revenue.percentChange, null);
});

test('the 31st compares against the whole of a shorter previous month', () => {
  const summary = summarizeMonthToDate(
    [
      job({ date_completed: '2026-09-30', final_price: 400 }),
      job({ date_completed: '2026-10-01', final_price: 100 }),
    ],
    new Date(2026, 9, 31, 12, 0),
  );
  assert.equal(summary.revenue.previous, 400);
  assert.equal(summary.revenue.current, 100);
});
