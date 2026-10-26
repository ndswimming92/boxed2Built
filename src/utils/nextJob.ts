import type { Job } from '../lib/supabase';

const UPCOMING_STATUSES = new Set(['accepted', 'scheduled', 'in_progress']);

function toDayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * The next job on the calendar: today or later, not finished or dropped, soonest
 * first. Jobs with no start time sort after timed jobs on the same day.
 */
export function findNextJob(jobs: Job[], now: Date = new Date()): Job | null {
  const today = toDayKey(now);

  const upcoming = jobs.filter(
    (job) =>
      job.is_active &&
      !job.date_completed &&
      UPCOMING_STATUSES.has(job.job_status) &&
      !!job.date_scheduled &&
      job.date_scheduled.slice(0, 10) >= today,
  );

  upcoming.sort((a, b) => {
    const byDate = a.date_scheduled!.slice(0, 10).localeCompare(b.date_scheduled!.slice(0, 10));
    if (byDate !== 0) return byDate;
    return (a.scheduled_start_time ?? '99:99').localeCompare(b.scheduled_start_time ?? '99:99');
  });

  return upcoming[0] ?? null;
}

/** '14:30:00' -> '2:30 PM' */
export function formatTimeOfDay(time: string | null): string | null {
  if (!time) return null;
  const [hours, minutes] = time.split(':').map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  const suffix = hours >= 12 ? 'PM' : 'AM';
  return `${hours % 12 || 12}:${String(minutes).padStart(2, '0')} ${suffix}`;
}
