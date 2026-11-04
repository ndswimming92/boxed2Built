import { supabase } from '../lib/supabase';
import type {
  OutreachPreview,
  PartnerCode,
  PartnerEmailEvent,
  PartnerLead,
  PartnerLeadEdit,
  PartnerLeadEmail,
} from '../types/partnerLeads';

const FETCH_SIZE = 1000;
/** A runaway guard, not a real limit. */
const FETCH_MAX_REQUESTS = 50;

/**
 * Every row of a Partner Leads table for one organization, read in pages. The
 * organization filter is on purpose, not just RLS: an admin of several
 * organizations would otherwise get every organization's leads in one list.
 */
async function fetchAll<T extends { id: string }>(
  table: 'partner_leads' | 'partner_lead_emails',
  organizationId: string,
  orderBy: string,
  what: string,
): Promise<T[]> {
  const rows: T[] = [];
  for (let request = 0; request < FETCH_MAX_REQUESTS; request += 1) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .eq('organization_id', organizationId)
      .order(orderBy, { ascending: false })
      .order('id', { ascending: false })
      .range(rows.length, rows.length + FETCH_SIZE - 1);
    if (error) {
      console.error(`Error fetching ${what}:`, error);
      throw new Error(`Failed to load ${what}: ${error.message}`);
    }
    const page = (data || []) as T[];
    if (page.length === 0) break;
    rows.push(...page);
  }
  const seen = new Set<string>();
  return rows.filter((row) => (seen.has(row.id) ? false : (seen.add(row.id), true)));
}

export function getPartnerLeads(organizationId: string): Promise<PartnerLead[]> {
  return fetchAll<PartnerLead>('partner_leads', organizationId, 'created_at', 'partner leads');
}

export function getPartnerLeadEmails(organizationId: string): Promise<PartnerLeadEmail[]> {
  return fetchAll<PartnerLeadEmail>('partner_lead_emails', organizationId, 'sent_at', 'sent emails');
}

/**
 * Save what the owner changed on a lead: its status, the draft, a corrected
 * contact, or notes. The database lets the browser write those columns and no
 * others, and only for owners and admins.
 */
export async function updatePartnerLead(
  leadId: string,
  organizationId: string,
  changes: PartnerLeadEdit,
): Promise<PartnerLead> {
  const { data, error } = await supabase
    .from('partner_leads')
    .update(changes)
    .eq('id', leadId)
    .eq('organization_id', organizationId)
    .select('*')
    .maybeSingle();
  if (error) {
    console.error('Error updating partner lead:', error);
    throw new Error(`Failed to save: ${error.message}`);
  }
  if (!data) throw new Error('Failed to save: you may not have permission to change this lead');
  return data as PartnerLead;
}

async function callOutreach<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('send-partner-outreach-email', { body });
  if (error) {
    let message = error.message || 'The email service did not respond';
    try {
      const errorBody = await (error as { context?: Response }).context?.json?.();
      if (errorBody?.error) message = errorBody.error;
    } catch {
      // keep the generic message
    }
    throw new Error(message);
  }
  if (!data) throw new Error('No response from the email service');
  return data as T;
}

/** The email exactly as it would go out. Sends nothing. */
export function previewOutreach(leadId: string, subject: string, body: string): Promise<OutreachPreview> {
  return callOutreach<OutreachPreview>({ leadId, subject, body, mode: 'preview' });
}

/** Sends the email to the signed-in admin only. */
export function sendOutreachTest(
  leadId: string,
  subject: string,
  body: string,
  attemptId: string,
): Promise<{ sent: true; to: string }> {
  return callOutreach({ leadId, subject, body, mode: 'test', attemptId });
}

/**
 * Sends the reviewed email to the lead. `confirmTo` is the address shown in the
 * review step; the server refuses the send if the saved address differs.
 * `attemptId` is made once per review step: a retry within it sends once, and
 * a new review step is a new, deliberate send.
 */
export function sendOutreach(
  leadId: string,
  subject: string,
  body: string,
  confirmTo: string,
  attemptId: string,
  sendAgain = false,
): Promise<{ sent: true; to: string; sentAt?: string; alreadySent?: boolean }> {
  return callOutreach({ leadId, subject, body, mode: 'send', confirmTo, attemptId, sendAgain });
}

const PARTNER_CODE_COLUMNS = 'id, code, discount_type, discount_value, is_active, times_used, last_used_at';

/** The coupons linked to these leads, by id. Missing ones are simply absent. */
export async function getPartnerCodes(couponIds: string[]): Promise<PartnerCode[]> {
  const ids = [...new Set(couponIds.filter(Boolean))];
  if (ids.length === 0) return [];
  const { data, error } = await supabase.from('coupons').select(PARTNER_CODE_COLUMNS).in('id', ids);
  if (error) {
    console.error('Error fetching partner codes:', error);
    throw new Error(`Failed to load partner codes: ${error.message}`);
  }
  return ((data || []) as PartnerCode[]).map((row) => ({ ...row, discount_value: Number(row.discount_value) }));
}

/**
 * Delivered / opened / clicked / bounced events for the organization's sent
 * outreach emails. Activity is extra information, so a failure (for example
 * before the database function exists) returns nothing rather than breaking
 * the page.
 */
export async function getPartnerEmailActivity(organizationId: string): Promise<PartnerEmailEvent[]> {
  const { data, error } = await supabase.rpc('get_partner_lead_email_activity', { p_organization_id: organizationId });
  if (error) {
    console.warn('Partner email activity unavailable:', error.message);
    return [];
  }
  return (data || []) as PartnerEmailEvent[];
}

/**
 * Makes the partner's code (a coupon) and links it to the lead. A lead that
 * already has one gets it back. A code already used anywhere is refused.
 */
export async function createPartnerCode(
  leadId: string,
  code: string,
  discountType: 'fixed' | 'percentage',
  discountValue: number,
): Promise<PartnerCode> {
  const { data, error } = await supabase.rpc('create_partner_lead_code', {
    p_lead_id: leadId,
    p_code: code,
    p_discount_type: discountType,
    p_discount_value: discountValue,
  });
  if (error) {
    console.error('Error creating partner code:', error);
    if (error.code === '23505') throw new Error('That code is already in use. Pick another one.');
    if (error.code === '23514') throw new Error('Codes are 3 to 30 letters, numbers or dashes, and the discount must be more than 0.');
    throw new Error(`Could not create the code: ${error.message}`);
  }
  const row = (Array.isArray(data) ? data[0] : data) as PartnerCode | null;
  if (!row) throw new Error('Could not create the code');
  return { ...row, discount_value: Number(row.discount_value) };
}
