import { useEffect, useId, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { JOB_COMPLETED_EVENT } from '../services/jobBoardService';
import {
  doneReaction,
  isFreshPayment,
  leadReaction,
  paidReaction,
  type BuildyReaction,
} from '../utils/buildy';

/**
 * The business events Buildy reacts to, as they happen:
 *
 * - a new inquiry (form_inquiries INSERT) — test submissions are skipped
 * - an invoice turning paid (invoices UPDATE/INSERT with a fresh paid_at)
 * - a job signed off (job_completions INSERT), plus the same-tab event the
 *   completion wizard fires, so it still works if realtime drops
 *
 * Each event is handed to `onReaction` once. Duplicates (the realtime row and
 * the same-tab event for one sign-off, or an invoice row updated twice after
 * it was paid) are dropped by key.
 *
 * Note that `jobs` itself is not in the realtime publication, so a job closed
 * by changing its status by hand (no sign-off) does not reach Buildy.
 */
export function useBuildyEvents(businessId: string | null, onReaction: (reaction: BuildyReaction) => void) {
  // Unique per hook instance — see useRealtimeInquiries for why topics must not repeat.
  const instanceId = useId();
  const onReactionRef = useRef(onReaction);

  useEffect(() => {
    onReactionRef.current = onReaction;
  }, [onReaction]);

  useEffect(() => {
    if (!businessId) return;

    const seen = new Set<string>();
    const emit = (reaction: BuildyReaction) => {
      if (seen.has(reaction.key)) return;
      seen.add(reaction.key);
      onReactionRef.current(reaction);
    };

    type InquiryRow = { id: string; client_name?: string | null; is_test?: boolean | null };
    type InvoiceRow = {
      id: string;
      status?: string | null;
      paid_at?: string | null;
      amount_paid?: number | null;
      is_test?: boolean | null;
    };
    type CompletionRow = { job_id?: string | null };

    const onInvoice = (row: InvoiceRow) => {
      if (isFreshPayment(row, Date.now())) emit(paidReaction(row));
    };

    const channel = supabase
      .channel(`buildy-events:${businessId}:${instanceId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'form_inquiries', filter: `business_id=eq.${businessId}` },
        (payload) => {
          const row = payload.new as InquiryRow;
          if (row?.id && !row.is_test) emit(leadReaction(row));
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'invoices', filter: `business_id=eq.${businessId}` },
        (payload) => onInvoice(payload.new as InvoiceRow),
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'invoices', filter: `business_id=eq.${businessId}` },
        (payload) => onInvoice(payload.new as InvoiceRow),
      )
      // job_completions has no business_id column; row-level security limits
      // what this channel receives to completions the signed-in admin can see.
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'job_completions' }, (payload) => {
        const row = payload.new as CompletionRow;
        if (row?.job_id) emit(doneReaction(row.job_id));
      })
      .subscribe();

    const onLocalCompletion = (event: Event) => {
      const jobId = (event as CustomEvent<{ jobId?: string }>).detail?.jobId;
      if (jobId) emit(doneReaction(jobId));
    };
    window.addEventListener(JOB_COMPLETED_EVENT, onLocalCompletion);

    return () => {
      window.removeEventListener(JOB_COMPLETED_EVENT, onLocalCompletion);
      supabase.removeChannel(channel);
    };
  }, [businessId, instanceId]);
}
