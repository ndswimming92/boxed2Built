import type { Job } from '../lib/supabase';

export type JobStatus = 'Quoted' | 'Scheduled' | 'Completed';

export const REFERRAL_SOURCES = [
  'Facebook',
  'Instagram',
  'Website',
  'Family',
  'Friend',
  'Google',
  'Yelp',
  'ChatGPT',
  'Claude',
  'Other',
] as const;

export function calculateNetProfit(
  finalPrice: number | null,
  materialsCost: number | null,
  contractorCost: number | null = 0
): number {
  if (finalPrice === null) return 0;
  const materials = materialsCost || 0;
  const contractors = contractorCost || 0;
  return finalPrice - materials - contractors;
}

export function calculateHourlyRate(
  finalPrice: number | null,
  materialsCost: number | null,
  hoursWorked: number | null,
  contractorCost: number | null = 0
): number {
  if (!hoursWorked || hoursWorked <= 0) return 0;
  const netProfit = calculateNetProfit(finalPrice, materialsCost, contractorCost);
  return netProfit / hoursWorked;
}

export function determineJobStatus(job: Partial<Job>): JobStatus {
  if (job.date_completed) {
    return 'Completed';
  }
  if (job.date_scheduled) {
    return 'Scheduled';
  }
  return 'Quoted';
}

export function getStatusColor(status: JobStatus): string {
  switch (status) {
    case 'Completed':
      return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case 'Scheduled':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'Quoted':
      return 'bg-amber-100 text-amber-800 border-amber-200';
    default:
      return 'bg-slate-100 text-slate-800 border-slate-200';
  }
}

export function formatCurrency(amount: number | null): string {
  if (amount === null || amount === undefined) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

/**
 * Today's date (or the given moment's) as 'YYYY-MM-DD' on the viewer's own
 * calendar. `toISOString().split('T')[0]` is the UTC date, which from a US
 * evening is already tomorrow — a job finished at 8pm on Saturday was recorded
 * as finished on Sunday.
 */
export function toLocalDateString(moment: Date = new Date()): string {
  const month = String(moment.getMonth() + 1).padStart(2, '0');
  const day = String(moment.getDate()).padStart(2, '0');
  return `${moment.getFullYear()}-${month}-${day}`;
}

/**
 * A date as the calendar day it names. Date columns (date_completed,
 * date_scheduled, invoice_date…) arrive as 'YYYY-MM-DD', which the Date
 * constructor reads as UTC midnight — still the evening of the day before
 * anywhere in the Americas, so a job finished on Sep 26 was shown as Sep 25.
 * A date with no time of day belongs to no zone: read its parts as written.
 * Anything with a time of day is a real moment and parses as one.
 */
export function parseCalendarDay(value: string): Date {
  const calendarDay = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return calendarDay
    ? new Date(Number(calendarDay[1]), Number(calendarDay[2]) - 1, Number(calendarDay[3]))
    : new Date(value);
}

export function formatDate(dateString: string | null): string {
  if (!dateString) return 'Not set';

  return parseCalendarDay(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export type FinishedJobTimes = {
  actual_end_time: string;
  date_completed: string;
  hours_worked: number;
};

/**
 * Actual end time, completion date and hours worked for a job finished at
 * `now`, measured from its scheduled start. The planned scheduled_end_time is
 * left alone, since customer emails quote it. Hours round to the nearest 0.1 and never
 * drop below 0.1, since a completed job needs positive hours.
 * Returns an error message instead when there is no usable start to measure
 * from: no scheduled date or start time, a start still in the future, or a
 * finish on a different calendar day than the scheduled one (overnight and
 * multi-day jobs, whose end time and hours must be entered by hand).
 */
export function calculateFinishedJobTimes(
  job: Pick<Job, 'date_scheduled' | 'scheduled_start_time'>,
  now: Date = new Date()
): FinishedJobTimes | { error: string } {
  const start = /^(\d{1,2}):(\d{2})/.exec(job.scheduled_start_time ?? '');
  if (!job.date_scheduled || !start) {
    return { error: 'Set a scheduled date and start time on this job so the hours can be calculated.' };
  }

  const startedAt = parseCalendarDay(job.date_scheduled);
  startedAt.setHours(Number(start[1]), Number(start[2]), 0, 0);

  const elapsedHours = (now.getTime() - startedAt.getTime()) / 3_600_000;
  if (elapsedHours <= 0) {
    return { error: 'The scheduled start time is still in the future, so the hours cannot be calculated.' };
  }
  // The end is a bare time of day, read on the job's own day, so an end on
  // another day cannot be stored.
  if (toLocalDateString(now) !== toLocalDateString(startedAt)) {
    return { error: 'This job did not finish on its scheduled day. Enter the end time, date and hours worked by hand.' };
  }

  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return {
    actual_end_time: `${hh}:${mm}`,
    date_completed: toLocalDateString(now),
    hours_worked: Math.max(0.1, Math.round(elapsedHours * 10) / 10),
  };
}

export function formatHours(hours: number | null): string {
  if (hours === null || hours === undefined) return '0 hrs';
  return `${hours.toFixed(2)} hrs`;
}
