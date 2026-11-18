import { supabase } from '../lib/supabase';
import { toDayKey, UPCOMING_JOB_STATUSES } from '../utils/nextJob';

/**
 * Anything that books, reschedules or closes a job can fire this to refresh the
 * admin rail straight away instead of waiting for the next poll.
 */
export const JOB_BOARD_CHANGED_EVENT = 'job-board-changed';

export function notifyJobBoardChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(JOB_BOARD_CHANGED_EVENT));
  }
}

/**
 * How many jobs are on the board: scheduled for today or later, still active,
 * not finished, and in a status that means the work is still ahead of us.
 *
 * A head count rather than a row fetch — this runs on every admin page, and the
 * rail only ever needs the number.
 */
export async function countUpcomingJobs(businessId: string | null): Promise<number> {
  if (!businessId) return 0;

  const { count, error } = await supabase
    .from('jobs')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', businessId)
    .eq('is_active', true)
    .is('date_completed', null)
    .in('job_status', UPCOMING_JOB_STATUSES as unknown as string[])
    .gte('date_scheduled', toDayKey(new Date()));

  if (error) throw new Error(error.message);
  return count ?? 0;
}
