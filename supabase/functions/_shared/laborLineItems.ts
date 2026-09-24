/**
 * "What's being built" for a job's calendar entry.
 *
 * job_type is a short, fixed category ("Furniture Assembly", "Table"); the
 * actual piece — "Farmhouse Queen Murphy Bed With Charging Station" — gets
 * typed once as an invoice's labor line item description, not duplicated onto
 * the job as a second free-text field. The calendar feed and the per-job
 * email both borrow it from there.
 */

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

export interface LaborInvoiceRow {
  id: string;
  job_id: string;
}

export interface LaborLineItemRow {
  invoice_id: string;
  description: string;
  display_order: number;
}

/**
 * Groups labor line-item descriptions by job, in invoice order (as given —
 * callers fetch oldest invoice first, so an item typed on the original
 * invoice keeps its place if a later one repeats it) and then display_order
 * within an invoice. A description already seen for that job — same text,
 * case- and whitespace-insensitively — is dropped rather than repeated,
 * which is the common case: a final invoice usually restates the deposit's
 * line items verbatim.
 *
 * Pure and synchronous so it is testable without a live Supabase client; the
 * actual fetch lives in loadLaborDescriptionsByJob below.
 */
export function groupLaborDescriptionsByJob(
  invoices: LaborInvoiceRow[],
  lineItems: LaborLineItemRow[],
): Map<string, string[]> {
  const byJob = new Map<string, string[]>();
  const seenByJob = new Map<string, Set<string>>();

  const itemsByInvoice = new Map<string, LaborLineItemRow[]>();
  for (const item of lineItems) {
    const list = itemsByInvoice.get(item.invoice_id) ?? [];
    list.push(item);
    itemsByInvoice.set(item.invoice_id, list);
  }
  for (const list of itemsByInvoice.values()) {
    list.sort((a, b) => a.display_order - b.display_order);
  }

  for (const invoice of invoices) {
    for (const item of itemsByInvoice.get(invoice.id) ?? []) {
      const description = item.description?.trim();
      if (!description) continue;

      const seen = seenByJob.get(invoice.job_id) ?? new Set<string>();
      const key = description.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      seenByJob.set(invoice.job_id, seen);

      const list = byJob.get(invoice.job_id) ?? [];
      list.push(description);
      byJob.set(invoice.job_id, list);
    }
  }

  return byJob;
}

/**
 * Labor line-item descriptions for each job, keyed by job id. Jobs with no
 * invoice yet, or none carrying a labor line, simply have no entry — callers
 * fall back to an empty list.
 *
 * A cancelled invoice's line items are never quoted back at anyone: the work
 * it described may not be happening at all.
 */
export async function loadLaborDescriptionsByJob(
  admin: SupabaseClient,
  jobIds: string[],
): Promise<Map<string, string[]>> {
  if (jobIds.length === 0) return new Map();

  const { data: invoices, error: invoicesError } = await admin
    .from('invoices')
    .select('id, job_id')
    .in('job_id', jobIds)
    .neq('status', 'cancelled')
    .order('created_at', { ascending: true })
    .returns<LaborInvoiceRow[]>();

  if (invoicesError) {
    console.error('loadLaborDescriptionsByJob: invoice query failed', invoicesError);
    return new Map();
  }
  if (!invoices?.length) return new Map();

  const { data: lineItems, error: lineItemsError } = await admin
    .from('invoice_line_items')
    .select('invoice_id, description, display_order')
    .in('invoice_id', invoices.map((invoice) => invoice.id))
    .eq('item_type', 'labor')
    .returns<LaborLineItemRow[]>();

  if (lineItemsError) {
    console.error('loadLaborDescriptionsByJob: line item query failed', lineItemsError);
    return new Map();
  }

  return groupLaborDescriptionsByJob(invoices, lineItems ?? []);
}

/** One job's labor descriptions — the single-job shorthand for loadLaborDescriptionsByJob. */
export async function loadLaborDescriptionsForJob(
  admin: SupabaseClient,
  jobId: string,
): Promise<string[]> {
  const byJob = await loadLaborDescriptionsByJob(admin, [jobId]);
  return byJob.get(jobId) ?? [];
}
