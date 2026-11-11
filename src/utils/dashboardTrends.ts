import type { Job } from '../lib/supabase';
import { parseJobDate } from '../services/analyticsCalculations.ts';

export interface MonthlyTrendPoint {
  /** 'YYYY-MM', stable across locales. */
  key: string;
  /** Short axis label, e.g. "Nov". */
  label: string;
  /** Full label for tooltips, e.g. "November 2026". */
  fullLabel: string;
  revenue: number;
  jobs: number;
  hours: number;
  /** The month `now` falls in, which is still accumulating. */
  inProgress: boolean;
}

export interface PeriodComparison {
  current: number;
  previous: number;
  /** Percent change, or null when there is no previous value to compare against. */
  percentChange: number | null;
}

export interface MonthToDateSummary {
  revenue: PeriodComparison;
  jobs: PeriodComparison;
  hours: PeriodComparison;
}

const monthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

/**
 * Completed-job revenue, count and hours for each of the last `months` calendar
 * months ending with the month `now` is in. Months with no completed work are
 * kept as zeros so a quiet month reads as a gap rather than silently vanishing
 * from the axis.
 */
export function buildMonthlyTrend(jobs: Job[], months = 12, now: Date = new Date()): MonthlyTrendPoint[] {
  const points: MonthlyTrendPoint[] = [];
  const byKey = new Map<string, MonthlyTrendPoint>();

  for (let offset = months - 1; offset >= 0; offset--) {
    const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const point: MonthlyTrendPoint = {
      key: monthKey(date),
      label: date.toLocaleDateString('en-US', { month: 'short' }),
      fullLabel: date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      revenue: 0,
      jobs: 0,
      hours: 0,
      inProgress: offset === 0,
    };
    points.push(point);
    byKey.set(point.key, point);
  }

  for (const job of jobs) {
    const completed = parseJobDate(job.date_completed);
    if (!completed) continue;
    const point = byKey.get(monthKey(completed));
    if (!point) continue;
    point.revenue += Number(job.final_price) || 0;
    point.hours += Number(job.hours_worked) || 0;
    point.jobs += 1;
  }

  return points;
}

function compare(current: number, previous: number): PeriodComparison {
  return {
    current,
    previous,
    percentChange: previous > 0 ? ((current - previous) / previous) * 100 : null,
  };
}

/**
 * This month so far against the same stretch of last month.
 *
 * Comparing a half-finished month with a whole one always looks like a slump,
 * so the previous month is cut off at the same day-of-month as `now`.
 */
export function summarizeMonthToDate(jobs: Job[], now: Date = new Date()): MonthToDateSummary {
  const currentStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const previousStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  // Day 0 of this month is the last day of the previous one; clamp so the 31st
  // compared against a 30-day month covers the whole of it rather than spilling over.
  const previousMonthLength = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
  const previousEnd = new Date(
    previousStart.getFullYear(),
    previousStart.getMonth(),
    Math.min(now.getDate(), previousMonthLength),
    23, 59, 59, 999,
  );

  const totals = {
    current: { revenue: 0, jobs: 0, hours: 0 },
    previous: { revenue: 0, jobs: 0, hours: 0 },
  };

  for (const job of jobs) {
    const completed = parseJobDate(job.date_completed);
    if (!completed) continue;
    let bucket: typeof totals.current | null = null;
    if (completed >= currentStart && completed <= now) bucket = totals.current;
    else if (completed >= previousStart && completed <= previousEnd) bucket = totals.previous;
    if (!bucket) continue;
    bucket.revenue += Number(job.final_price) || 0;
    bucket.hours += Number(job.hours_worked) || 0;
    bucket.jobs += 1;
  }

  return {
    revenue: compare(totals.current.revenue, totals.previous.revenue),
    jobs: compare(totals.current.jobs, totals.previous.jobs),
    hours: compare(totals.current.hours, totals.previous.hours),
  };
}
