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

export function formatHours(hours: number | null): string {
  if (hours === null || hours === undefined) return '0 hrs';
  return `${hours.toFixed(2)} hrs`;
}
