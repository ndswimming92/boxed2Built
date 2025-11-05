import { Job } from '../lib/supabase';

export type JobStatus = 'Quoted' | 'Scheduled' | 'Completed';

export const REFERRAL_SOURCES = [
  'Facebook',
  'Instagram',
  'Website',
  'Family',
  'Friend',
  'Google',
  'Yelp',
  'Other',
] as const;

export function calculateNetProfit(finalPrice: number | null, materialsCost: number | null): number {
  if (finalPrice === null) return 0;
  const materials = materialsCost || 0;
  return finalPrice - materials;
}

export function calculateHourlyRate(
  finalPrice: number | null,
  materialsCost: number | null,
  hoursWorked: number | null
): number {
  if (!hoursWorked || hoursWorked <= 0) return 0;
  const netProfit = calculateNetProfit(finalPrice, materialsCost);
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

export function formatDate(dateString: string | null): string {
  if (!dateString) return 'Not set';
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatHours(hours: number | null): string {
  if (hours === null || hours === undefined) return '0 hrs';
  return `${hours.toFixed(2)} hrs`;
}
