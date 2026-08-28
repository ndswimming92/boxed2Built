import type { FormInquiry } from '../lib/supabase';

/**
 * The Inquiries page is a working list, not an archive.
 *
 * An inquiry is finished once both of the things the owner actually does with a
 * lead have happened: it turned into a job, and the customer has heard back.
 * Until then it stays on the list. Once both are true it is "wrapped up" and
 * drops out of the default view on its own, so a good month of converted work
 * does not bury the one submission still waiting on a reply. Nothing is
 * deleted — the Wrapped Up and All Statuses filters still show every one.
 *
 * Deliberately derived from the columns the app already writes rather than a
 * stored flag, so inquiries converted before this existed are wrapped up too,
 * and so the conversion-rate stat keeps counting them as converted (archiving
 * them would have overwritten that status).
 */

export type InquiryStatusFilter =
  | 'needs_attention'
  | 'all'
  | 'pending'
  | 'converted_to_job'
  | 'wrapped_up'
  | 'archived';

/** The fields the workflow rules read — a full FormInquiry always satisfies it. */
export type InquiryWorkflowFields = Pick<
  FormInquiry,
  'status' | 'first_responded_at' | 'last_contact_date' | 'response_count'
>;

/**
 * Any recorded contact counts, not only the Reached Out button. Sending an
 * invoice logs a communication, which stamps last_contact_date and bumps
 * response_count without ever touching first_responded_at.
 */
export function hasReachedOut(inquiry: InquiryWorkflowFields): boolean {
  return (
    Boolean(inquiry.first_responded_at) ||
    Boolean(inquiry.last_contact_date) ||
    (inquiry.response_count ?? 0) > 0
  );
}

/** Converted to a job and the customer has heard back — nothing left to do. */
export function isWrappedUp(inquiry: InquiryWorkflowFields): boolean {
  return inquiry.status === 'converted_to_job' && hasReachedOut(inquiry);
}

/**
 * Booked but nobody has replied yet. These stay on the list on purpose: the
 * job exists, the customer is still waiting to hear it.
 */
export function isAwaitingOutreach(inquiry: InquiryWorkflowFields): boolean {
  return inquiry.status === 'converted_to_job' && !hasReachedOut(inquiry);
}

/** Everything still asking something of you: not wrapped up, not dismissed. */
export function needsAttention(inquiry: InquiryWorkflowFields): boolean {
  return inquiry.status !== 'archived' && !isWrappedUp(inquiry);
}

export function matchesStatusFilter(
  inquiry: InquiryWorkflowFields,
  filter: InquiryStatusFilter
): boolean {
  switch (filter) {
    case 'needs_attention':
      return needsAttention(inquiry);
    case 'all':
      return true;
    case 'wrapped_up':
      return isWrappedUp(inquiry);
    default:
      return inquiry.status === filter;
  }
}
