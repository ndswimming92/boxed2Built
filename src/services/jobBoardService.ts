import { supabase } from '../lib/supabase';
import { summarizeJobBoard, toDayKey, UPCOMING_JOB_STATUSES } from '../utils/nextJob';
import { EMPTY_BOARD, type JobBoardSummary } from '../utils/buildy';

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
 * Fired in this tab when a job is signed off, so Buildy can celebrate straight
 * away. The job_completions realtime row usually arrives too; he dedupes them.
 */
export const JOB_COMPLETED_EVENT = 'job-completed';

export function notifyJobCompleted(jobId: string) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(JOB_COMPLETED_EVENT, { detail: { jobId } }));
  }
}

/**
 * What is on the board: jobs scheduled for today or later, still active, not
 * finished, and in a status that means the work is still ahead of us. Returns
 * the total, today's and this week's counts, and the soonest job.
 *
 * This runs on every admin page, so it fetches only the two columns it needs
 * and only for upcoming jobs, which for a small business is a handful of rows.
 */
export async function fetchJobBoardSummary(businessId: string | null): Promise<JobBoardSummary> {
  if (!businessId) return EMPTY_BOARD;

  const { data, error } = await supabase
    .from('jobs')
    .select('id, date_scheduled')
    .eq('business_id', businessId)
    .eq('is_active', true)
    .is('date_completed', null)
    .in('job_status', UPCOMING_JOB_STATUSES as unknown as string[])
    .gte('date_scheduled', toDayKey(new Date()))
    .order('date_scheduled', { ascending: true })
    .order('scheduled_start_time', { ascending: true, nullsFirst: false });

  if (error) throw new Error(error.message);
  return summarizeJobBoard(data ?? []);
}
