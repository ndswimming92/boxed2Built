import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { authorizeAdminOrService } from '../_shared/authorize.ts';
import {
  BLOCKED_STATUSES,
  OUTREACH_FROM_EMAIL,
  OUTREACH_FROM_NAME,
  RESEND_GUARD_DAYS,
  checkOutreach,
  daysSince,
  idempotencyKey,
  isSendableAddress,
  normalizeBody,
  normalizeSubject,
  renderOutreach,
} from '../_shared/partnerOutreach.ts';

/**
 * Sends one partnership outreach email from Admin > Partner Leads.
 *
 * POST {leadId, subject, body, mode: "preview"} returns the email exactly as it
 *   would go out (subject, html, text, to, from) and sends nothing. The page
 *   shows this in its review step, so what Nicholas checks is what is sent.
 * POST {..., mode: "test"} sends that email to the signed-in admin only. The
 *   recipient comes from the caller's token, never from the request.
 * POST {..., mode: "send", confirmTo} sends it to the lead. `confirmTo` must
 *   match the lead's saved address as it is now, so an address changed after
 *   the review step cannot be mailed without being reviewed again. Refused for
 *   not_a_fit and do_not_contact leads, and, unless `sendAgain` is true, for a
 *   lead emailed in the last seven days.
 *
 * A signed-in admin only; a service-role call cannot send, because every send
 * is meant to be a person's decision. The recipient is always the lead's
 * stored address, read here, never an address from the request body.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type, Authorization, X-Client-Info, Apikey, X-Correlation-Id, X-Session-Correlation-Id',
};

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
/** The postal address for the footer, e.g. "PO Box 123, Spring Hill, TN 37174". */
const POSTAL_ADDRESS = Deno.env.get('OUTREACH_POSTAL_ADDRESS') ?? null;

type Mode = 'preview' | 'test' | 'send';

interface Payload {
  leadId?: unknown;
  subject?: unknown;
  body?: unknown;
  mode?: unknown;
  confirmTo?: unknown;
  sendAgain?: unknown;
  /**
   * One id per review step, made by the page. A retry or double click within
   * that step reuses it, so Resend sends once; opening the review step again
   * makes a new one, so a deliberate second email is not mistaken for a retry.
   */
  attemptId?: unknown;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const auth = await authorizeAdminOrService(req);
  if (!auth.ok) return json({ error: auth.error }, auth.status ?? 401);
  if (!auth.user) return json({ error: 'Outreach is sent by a signed-in admin only' }, 403);

  let payload: Payload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const leadId = typeof payload.leadId === 'string' ? payload.leadId : '';
  const mode = payload.mode as Mode;
  const subject = typeof payload.subject === 'string' ? payload.subject : '';
  const body = typeof payload.body === 'string' ? payload.body : '';

  if (!UUID.test(leadId)) return json({ error: 'leadId is required' }, 400);
  if (mode !== 'preview' && mode !== 'test' && mode !== 'send') return json({ error: 'Unknown mode' }, 400);

  const problem = checkOutreach(subject, body);
  if (problem) return json({ error: problem }, 422);

  const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  const { data: lead, error: leadError } = await db
    .from('partner_leads')
    .select('id, organization_id, name, email, status, last_emailed_at, emails_sent')
    .eq('id', leadId)
    .maybeSingle();
  if (leadError) {
    console.error('send-partner-outreach-email: lead lookup failed', leadError);
    return json({ error: 'Could not load the lead' }, 500);
  }
  if (!lead) return json({ error: 'Lead not found' }, 404);

  const to = lead.email?.trim() ?? null;
  const rendered = renderOutreach({ subject, body, postalAddress: POSTAL_ADDRESS, leadName: lead.name });
  const from = `${OUTREACH_FROM_NAME} <${OUTREACH_FROM_EMAIL}>`;
  const blocked = (BLOCKED_STATUSES as readonly string[]).includes(lead.status);
  const sinceLast = daysSince(lead.last_emailed_at);
  const recentlyEmailed = sinceLast !== null && sinceLast < RESEND_GUARD_DAYS;

  if (mode === 'preview') {
    return json({
      to: isSendableAddress(to) ? to : null,
      from,
      replyTo: OUTREACH_FROM_EMAIL,
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html,
      blocked,
      recentlyEmailed,
      lastEmailedAt: lead.last_emailed_at,
      postalAddressSet: true,
    });
  }

  if (!RESEND_API_KEY) return json({ error: 'Email sending is not configured' }, 500);

  let recipient: string;
  if (mode === 'test') {
    if (!isSendableAddress(auth.user.email)) return json({ error: 'Your account has no email to send a test to' }, 422);
    recipient = auth.user.email.trim();
  } else {
    if (blocked) return json({ error: 'This lead is marked not to be contacted' }, 409);
    if (!isSendableAddress(to)) return json({ error: 'This lead has no usable email address' }, 422);
    if (typeof payload.confirmTo !== 'string' || payload.confirmTo.trim().toLowerCase() !== to.toLowerCase()) {
      return json({ error: 'The address changed since you reviewed this email. Review it again.' }, 409);
    }
    if (recentlyEmailed && payload.sendAgain !== true) {
      return json({ error: 'This lead was emailed in the last week', lastEmailedAt: lead.last_emailed_at }, 409);
    }
    recipient = to;
  }

  const attemptId = typeof payload.attemptId === 'string' && UUID.test(payload.attemptId) ? payload.attemptId : null;
  // Resend replays the first response for a repeated key for 24 hours without
  // sending. The content is always part of the key, so an edited email is a
  // new send; the attempt id separates a deliberate resend of the same text
  // from a retry of the same click.
  const key = await idempotencyKey(
    lead.id,
    `${mode}:${attemptId ?? 'no-attempt'}:${recipient}`,
    normalizeSubject(subject),
    normalizeBody(body),
  );

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': key,
    },
    body: JSON.stringify({
      from,
      to: [recipient],
      subject: mode === 'test' ? `[Test] ${rendered.subject}` : rendered.subject,
      html: rendered.html,
      text: rendered.text,
      reply_to: OUTREACH_FROM_EMAIL,
      tags: [{ name: 'category', value: 'partner_outreach' }],
    }),
  });

  if (!res.ok) {
    console.error('send-partner-outreach-email: Resend rejected the send', lead.id, res.status, await res.text());
    return json({ error: 'The email service rejected the send. Nothing was sent.' }, 502);
  }
  const sent = (await res.json().catch(() => ({}))) as { id?: string };

  if (mode === 'test') return json({ sent: true, to: recipient, test: true });

  const sentAt = new Date().toISOString();

  // A replayed response carries the id of the email already logged. The unique
  // index on resend_id makes the log insert a no-op then, and nothing else is
  // touched, so a retry can never add a second history row or count.
  const { data: logged, error: logError } = await db
    .from('partner_lead_emails')
    .upsert(
      {
        organization_id: lead.organization_id,
        lead_id: lead.id,
        to_email: recipient,
        subject: rendered.subject,
        body: rendered.text,
        resend_id: sent.id ?? null,
        sent_by: auth.user.id,
        sent_at: sentAt,
      },
      { onConflict: 'resend_id', ignoreDuplicates: true },
    )
    .select('id');
  if (logError) console.error('send-partner-outreach-email: could not log the send', lead.id, logError);
  if (!logError && (logged ?? []).length === 0) {
    return json({ sent: true, to: recipient, alreadySent: true, resendId: sent.id ?? null });
  }

  const { count } = await db
    .from('partner_lead_emails')
    .select('id', { count: 'exact', head: true })
    .eq('lead_id', lead.id);

  // Send bookkeeping only; status is handled separately below.
  const { error: updateError } = await db
    .from('partner_leads')
    .update({
      last_emailed_at: sentAt,
      emails_sent: count ?? (lead.emails_sent ?? 0) + 1,
      draft_subject: rendered.subject,
      draft_body: normalizeBody(body),
    })
    .eq('id', lead.id);
  if (updateError) console.error('send-partner-outreach-email: could not update the lead', lead.id, updateError);

  // New -> Contacted only if the row is still New now. Judged by the database
  // at update time, not by the snapshot read before sending, so a status set
  // while the email was in flight (Do not contact, say) is never overwritten.
  const { error: statusError } = await db
    .from('partner_leads')
    .update({ status: 'contacted' })
    .eq('id', lead.id)
    .eq('status', 'new');
  if (statusError) console.error('send-partner-outreach-email: could not mark the lead contacted', lead.id, statusError);

  return json({ sent: true, to: recipient, sentAt, resendId: sent.id ?? null });
});
