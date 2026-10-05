import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  calculateHourlyRate,
  calculateNetProfit,
  formatCurrency,
  formatDate,
  formatHours,
} from '../../src/utils/jobCalculations.ts';

test('net profit is the price less materials and contractor pay', () => {
  assert.equal(calculateNetProfit(300, 45.5), 254.5);
  assert.equal(calculateNetProfit(300, 45.5, 54.5), 200);
  assert.equal(calculateNetProfit(300, null, null), 300);
});

test('a job with no final price has no profit', () => {
  assert.equal(calculateNetProfit(null, 45.5, 10), 0);
});

test('the hourly rate is the net profit over the hours worked', () => {
  assert.equal(calculateHourlyRate(300, 50, 5), 50);
  assert.equal(calculateHourlyRate(300, 50, 5, 50), 40);
});

test('no hours means no hourly rate, not a division by zero', () => {
  assert.equal(calculateHourlyRate(300, 50, 0), 0);
  assert.equal(calculateHourlyRate(300, 50, null), 0);
  assert.equal(calculateHourlyRate(300, 50, -2), 0);
});

test('money and hours format the way the job card prints them', () => {
  assert.equal(formatCurrency(254.5), '$254.50');
  assert.equal(formatCurrency(null), '$0.00');
  assert.equal(formatHours(4.5), '4.50 hrs');
  assert.equal(formatHours(null), '0 hrs');
});

test('a date with no time of day is the calendar day it names, in any timezone', () => {
  // date_completed is a Postgres date, so it arrives as 'YYYY-MM-DD'. Read as UTC
  // midnight it was still the evening before in the US, and a job finished on
  // Sep 26 showed as Sep 25. The runner is usually UTC, where that bug cannot
  // show, and the zone is fixed when a process starts — so each zone gets a
  // process of its own.
  const modulePath = fileURLToPath(new URL('../../src/utils/jobCalculations.ts', import.meta.url));
  const script = `
    import { formatDate } from ${JSON.stringify(modulePath)};
    console.log(JSON.stringify([
      formatDate('2026-09-26'),
      formatDate('2026-01-01'),
      formatDate('2026-12-31'),
    ]));
  `;

  for (const timeZone of ['America/Chicago', 'America/Los_Angeles', 'UTC', 'Pacific/Auckland']) {
    const out = execFileSync(process.execPath, ['--input-type=module', '-e', script], {
      env: { ...process.env, TZ: timeZone },
      encoding: 'utf8',
    });

    assert.deepEqual(
      JSON.parse(out),
      ['Sep 26, 2026', 'Jan 1, 2026', 'Dec 31, 2026'],
      `in ${timeZone}`,
    );
  }
});

test('a timestamp still formats as the moment it names', () => {
  assert.equal(formatDate('2026-09-26T18:00:00Z').length > 0, true);
  assert.notEqual(formatDate('2026-09-26T18:00:00Z'), 'Invalid Date');
});

test('no date reads as not set', () => {
  assert.equal(formatDate(null), 'Not set');
  assert.equal(formatDate(''), 'Not set');
});
