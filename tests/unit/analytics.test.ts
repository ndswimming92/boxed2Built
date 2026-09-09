import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calculateMetrics,
  calculateConversionMetrics,
  filterJobsByDateRange,
  filterPipelineJobsByDateRange,
  getJobTypePerformance,
  getMonthlyData,
  getPricingRecommendations,
  getProfitabilityLeaderboard,
  parseJobDate,
} from '../../src/services/analyticsCalculations.ts';
import type { Job } from '../../src/lib/supabase.ts';

type JobOverrides = Partial<Job>;

let seq = 0;
function job(overrides: JobOverrides): Job {
  seq += 1;
  return {
    id: `job-${seq}`,
    client_name: `Client ${seq}`,
    job_type: 'Furniture Assembly',
    job_status: 'completed',
    date_quoted: null,
    date_scheduled: null,
    date_completed: null,
    hours_worked: null,
    quoted_price: null,
    final_price: null,
    materials_cost: null,
    repeat_client: false,
    is_free: false,
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  } as Job;
}

const close = (actual: number, expected: number, msg?: string) =>
  assert.ok(Math.abs(actual - expected) < 0.01, `${msg ?? ''} expected ~${expected}, got ${actual}`);

const yearRange = (year: number): [Date, Date] => {
  const start = new Date(year, 0, 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(year, 11, 31);
  end.setHours(23, 59, 59, 999);
  return [start, end];
};

test('parseJobDate keeps a date-only string on its own local calendar day', () => {
  const d = parseJobDate('2026-01-01')!;
  assert.equal(d.getFullYear(), 2026);
  assert.equal(d.getMonth(), 0);
  assert.equal(d.getDate(), 1);
});

test('a job completed on the first day of the range stays in the range', () => {
  const jobs = [job({ date_completed: '2026-01-01', hours_worked: 2, final_price: 200 })];
  const [start, end] = yearRange(2026);
  assert.equal(filterJobsByDateRange(jobs, start, end).length, 1);
});

test('a job completed on the last day of the range stays in the range', () => {
  const jobs = [job({ date_completed: '2026-12-31', hours_worked: 2, final_price: 200 })];
  const [start, end] = yearRange(2026);
  assert.equal(filterJobsByDateRange(jobs, start, end).length, 1);
});

test('range filtering excludes neighbouring years on both sides', () => {
  const jobs = [
    job({ date_completed: '2025-12-31', final_price: 100, hours_worked: 1 }),
    job({ date_completed: '2026-06-01', final_price: 100, hours_worked: 1 }),
    job({ date_completed: '2027-01-01', final_price: 100, hours_worked: 1 }),
  ];
  const [start, end] = yearRange(2026);
  const kept = filterJobsByDateRange(jobs, start, end);
  assert.equal(kept.length, 1);
  assert.equal(kept[0].date_completed, '2026-06-01');
});

test('monthly buckets land in the month the job was completed', () => {
  const jobs = [
    job({ date_completed: '2026-01-01', final_price: 100, hours_worked: 1 }),
    job({ date_completed: '2026-03-31', final_price: 200, hours_worked: 1 }),
  ];
  const months = getMonthlyData(jobs, 'all_time');
  assert.deepEqual(months.map(m => m.month), ['Jan 2026', 'Mar 2026']);
});

test('hourly rates divide by paid hours, not hours given away free', () => {
  const jobs = [
    job({ date_completed: '2026-02-01', hours_worked: 4, final_price: 400 }),
    job({ date_completed: '2026-02-02', hours_worked: 6, final_price: null, is_free: true }),
  ];
  const m = calculateMetrics(jobs, 'all_time');

  assert.equal(m.totalJobs, 2);
  assert.equal(m.paidJobs, 1);
  assert.equal(m.freeJobs, 1);
  close(m.totalHours, 10, 'totalHours');
  close(m.paidHours, 4, 'paidHours');
  close(m.freeHours, 6, 'freeHours');

  close(m.avgHourlyRate, 100, 'revenue per paid hour');
  close(m.blendedHourlyRate, 40, 'revenue across all hours');
});

test('profit per hour and avg hourly rate are different numbers once materials exist', () => {
  const jobs = [job({ date_completed: '2026-02-01', hours_worked: 2, final_price: 200, materials_cost: 50 })];
  const m = calculateMetrics(jobs, 'all_time');
  close(m.avgHourlyRate, 100, 'revenue rate');
  close(m.profitPerHour, 75, 'profit rate');
  assert.notEqual(m.avgHourlyRate, m.profitPerHour);
});

test('a $0 quote does not blow up the quoted-vs-final ratio', () => {
  const jobs = [
    job({ date_completed: '2026-02-01', hours_worked: 1, final_price: 30, quoted_price: 0 }),
    job({ date_completed: '2026-02-02', hours_worked: 1, final_price: 110, quoted_price: 100 }),
  ];
  const m = calculateMetrics(jobs, 'all_time');
  close(m.quotedVsFinalRatio, 1.1, 'ratio should ignore the $0 quote');
});

test('avg hours per job ignores jobs with no hours logged', () => {
  const jobs = [
    job({ date_completed: '2026-02-01', hours_worked: 4, final_price: 100 }),
    job({ date_completed: '2026-02-02', hours_worked: null, final_price: 100 }),
  ];
  close(calculateMetrics(jobs, 'all_time').avgHoursPerJob, 4, 'avgHoursPerJob');
});

test('a legitimately $0 paid job is still counted, not silently dropped', () => {
  const jobs = [
    job({ date_completed: '2026-02-01', hours_worked: 1, final_price: 0 }),
    job({ date_completed: '2026-02-02', hours_worked: 1, final_price: 100 }),
    job({ date_completed: '2026-02-03', hours_worked: 1, final_price: 100 }),
  ];
  const perf = getJobTypePerformance(jobs, 'all_time');
  assert.equal(perf[0].count, 3);
});

test('pricing recommendation hits the target rate exactly', () => {
  const jobs = [
    job({ date_completed: '2026-02-01', hours_worked: 2, final_price: 200 }),
    job({ date_completed: '2026-02-02', hours_worked: 2, final_price: 200 }),
    job({ date_completed: '2026-02-03', hours_worked: 2, final_price: 200 }),
  ];
  const [rec] = getPricingRecommendations(jobs, 'all_time', 150);

  close(rec.currentAvgHourlyRate, 100, 'current rate');
  close(rec.avgHours, 2, 'avg hours');
  // 2 hrs at $150/hr = $300
  close(rec.recommendedTarget, 300, 'target price');
  close(rec.priceAdjustmentNeeded, 50, 'adjustment %');
});

test('pricing recommendation covers materials on top of the target rate', () => {
  const jobs = [
    job({ date_completed: '2026-02-01', hours_worked: 2, final_price: 250, materials_cost: 50 }),
    job({ date_completed: '2026-02-02', hours_worked: 2, final_price: 250, materials_cost: 50 }),
    job({ date_completed: '2026-02-03', hours_worked: 2, final_price: 250, materials_cost: 50 }),
  ];
  const [rec] = getPricingRecommendations(jobs, 'all_time', 150);

  // profit rate today: ($250 - $50) / 2hrs = $100/hr
  close(rec.currentAvgHourlyRate, 100, 'current profit rate');
  // 2 hrs at $150/hr = $300 profit, plus $50 materials = $350 price
  close(rec.recommendedTarget, 350, 'target price must cover materials');

  // Charging the recommended price really does produce the target rate.
  const realisedRate = (rec.recommendedTarget - 50) / rec.avgHours;
  close(realisedRate, 150, 'realised profit rate');
});

test('the recommended range brackets the recommended target', () => {
  const jobs = [
    job({ date_completed: '2026-02-01', hours_worked: 1, final_price: 50 }),
    job({ date_completed: '2026-02-02', hours_worked: 2, final_price: 200 }),
    job({ date_completed: '2026-02-03', hours_worked: 4, final_price: 400 }),
  ];
  const [rec] = getPricingRecommendations(jobs, 'all_time', 85);
  assert.ok(rec.recommendedMin <= rec.recommendedTarget, 'min must not exceed target');
  assert.ok(rec.recommendedTarget <= rec.recommendedMax, 'target must not exceed max');
});

test('free jobs stay out of the pricing sample', () => {
  const jobs = [
    job({ date_completed: '2026-02-01', hours_worked: 2, final_price: 200 }),
    job({ date_completed: '2026-02-02', hours_worked: 2, final_price: 200 }),
    job({ date_completed: '2026-02-03', hours_worked: 2, final_price: 200 }),
    job({ date_completed: '2026-02-04', hours_worked: 8, final_price: null, is_free: true }),
  ];
  const [rec] = getPricingRecommendations(jobs, 'all_time', 100);
  close(rec.currentAvgHourlyRate, 100, 'free job must not drag the rate down');
});

test('the funnel keeps jobs that never completed', () => {
  const jobs = [
    job({ date_completed: '2026-03-01', final_price: 200, quoted_price: 200, hours_worked: 2 }),
    job({ job_status: 'quoted', date_quoted: '2026-03-05', quoted_price: 300 }),
    job({ job_status: 'lost', date_quoted: '2026-03-06', quoted_price: 150 }),
  ];
  const [start, end] = yearRange(2026);

  const pipeline = filterPipelineJobsByDateRange(jobs, start, end);
  assert.equal(pipeline.length, 3, 'open and lost jobs must survive the range filter');

  const cm = calculateConversionMetrics(pipeline, 'all_time');
  assert.equal(cm.quotedJobs, 1);
  assert.equal(cm.lostJobs, 1);
  assert.equal(cm.activePipelineValue, 300);
  assert.equal(cm.lostOpportunityValue, 150);
  close(cm.winRate, 50, 'win rate');
});

test('a job outside the range is excluded from the funnel by its quote date', () => {
  const jobs = [job({ job_status: 'quoted', date_quoted: '2025-11-01', quoted_price: 300 })];
  const [start, end] = yearRange(2026);
  assert.equal(filterPipelineJobsByDateRange(jobs, start, end).length, 0);
});

test('best and worst performer lists never share a job', () => {
  const jobs = Array.from({ length: 5 }, (_, i) =>
    job({ date_completed: `2026-02-0${i + 1}`, hours_worked: 1, final_price: (i + 1) * 100 })
  );
  const { topJobs, bottomJobs } = getProfitabilityLeaderboard(jobs, 'all_time', 10);
  const overlap = topJobs.filter(t => bottomJobs.some(b => b.id === t.id));
  assert.equal(overlap.length, 0, 'a job cannot be both a best and a worst performer');
});
