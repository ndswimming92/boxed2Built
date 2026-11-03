import { supabase } from '../lib/supabase';
import type { OutreachPreview, PartnerLead, PartnerLeadEdit, PartnerLeadEmail } from '../types/partnerLeads';

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
export function sendOutreachTest(leadId: string, subject: string, body: string): Promise<{ sent: true; to: string }> {
  return callOutreach({ leadId, subject, body, mode: 'test' });
}

/**
 * Sends the reviewed email to the lead. `confirmTo` is the address shown in the
 * review step; the server refuses the send if the saved address differs.
 */
export function sendOutreach(
  leadId: string,
  subject: string,
  body: string,
  confirmTo: string,
  sendAgain = false,
): Promise<{ sent: true; to: string; sentAt: string }> {
  return callOutreach({ leadId, subject, body, mode: 'send', confirmTo, sendAgain });
}
