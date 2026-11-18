import { useEffect, useId, useState } from 'react';
import { supabase } from '../lib/supabase';
import { countUpcomingJobs, JOB_BOARD_CHANGED_EVENT } from '../services/jobBoardService';

/** A slow backstop; realtime and the change event do the real work. */
const POLL_INTERVAL_MS = 5 * 60 * 1000;
/** A bulk import fires one row change per job — coalesce them into one count. */
const COALESCE_MS = 400;

/**
 * How many jobs are on the board right now. Drives the admin rail, so it has to
 * be cheap: one head count, refreshed when a job row changes, when something
 * fires the change event, when the tab comes back, and every few minutes.
 */
export function useUpcomingJobCount(businessId: string | null): number {
  // Unique per hook instance, same reason as useRealtimeJobs: supabase.channel()
  // returns an already-joined channel for a repeated topic and .on() throws on it.
  const instanceId = useId();
  // Keyed by business so a switch reads 0 until the new count lands, rather than
  // briefly showing the old one — and so the effect never has to reset it.
  const [result, setResult] = useState<{ businessId: string | null; count: number }>({
    businessId: null,
    count: 0,
  });

  useEffect(() => {
    if (!businessId) return;

    let cancelled = false;
    let coalesceTimer: ReturnType<typeof setTimeout> | null = null;

    const refresh = async () => {
      try {
        const next = await countUpcomingJobs(businessId);
        if (!cancelled) setResult({ businessId, count: next });
      } catch {
        // A mascot is not worth an error banner. Leave the last good number up.
      }
    };

    const refreshSoon = () => {
      if (coalesceTimer) clearTimeout(coalesceTimer);
      coalesceTimer = setTimeout(refresh, COALESCE_MS);
    };

    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };

    refresh();

    const interval = setInterval(refresh, POLL_INTERVAL_MS);
    window.addEventListener(JOB_BOARD_CHANGED_EVENT, refreshSoon);
    document.addEventListener('visibilitychange', onVisible);

    const channel = supabase
      .channel(`job-board-count:${businessId}:${instanceId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'jobs', filter: `business_id=eq.${businessId}` },
        refreshSoon
      )
      .subscribe();

    return () => {
      cancelled = true;
      if (coalesceTimer) clearTimeout(coalesceTimer);
      clearInterval(interval);
      window.removeEventListener(JOB_BOARD_CHANGED_EVENT, refreshSoon);
      document.removeEventListener('visibilitychange', onVisible);
      supabase.removeChannel(channel);
    };
  }, [businessId, instanceId]);

  return result.businessId === businessId ? result.count : 0;
}
