import type { Job, JobStatus } from '../lib/supabase';

/**
 * Still ahead of us: quoted work hasn't been won yet, and completed, lost or
 * cancelled work is behind us. One definition, shared by the next-job banner
 * and the upcoming-job count the admin rail runs on.
 */
export const UPCOMING_JOB_STATUSES: readonly JobStatus[] = ['accepted', 'scheduled', 'in_progress'];

const UPCOMING_STATUSES = new Set<string>(UPCOMING_JOB_STATUSES);

/** `date_scheduled` is a plain `date` column, so compare it in the viewer's own day. */
export function toDayKey(date: Date): string {
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

/** Seven days from `today`, both as YYYY-MM-DD keys: today through today + 6. */
function weekEndKey(now: Date): string {
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 6);
  return toDayKey(end);
}

/**
 * Counts for the admin rail from rows that are already known to be upcoming
 * (active, unfinished, an upcoming status, scheduled today or later). Rows are
 * expected soonest first; the first one is the next job.
 */
export function summarizeJobBoard(
  rows: { id: string; date_scheduled: string | null }[],
  now: Date = new Date(),
): { upcoming: number; today: number; week: number; nextJobId: string | null } {
  const today = toDayKey(now);
  const weekEnd = weekEndKey(now);
  let todayCount = 0;
  let weekCount = 0;
  for (const row of rows) {
    const day = row.date_scheduled?.slice(0, 10);
    if (!day) continue;
    if (day === today) todayCount += 1;
    if (day >= today && day <= weekEnd) weekCount += 1;
  }
  return { upcoming: rows.length, today: todayCount, week: weekCount, nextJobId: rows[0]?.id ?? null };
}

/** '14:30:00' -> '2:30 PM' */
export function formatTimeOfDay(time: string | null): string | null {
  if (!time) return null;
  const [hours, minutes] = time.split(':').map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  const suffix = hours >= 12 ? 'PM' : 'AM';
  return `${hours % 12 || 12}:${String(minutes).padStart(2, '0')} ${suffix}`;
}
