import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';
import { authorizeAdminOrService } from '../_shared/authorize.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const FROM_EMAIL = 'team@boxed2built.com';
// team@boxed2built.com cannot receive mail — it hard-bounces. This is the
// address that actually accepts replies.
const REPLY_TO_EMAIL = 'replies@reply.boxed2built.com';
const APP_URL = 'https://boxed2built.com';

/** One hour of queue at a time. The cron runs hourly, so this is generous. */
const BATCH_SIZE = 50;

interface QueueRow {
  id: string;
  customer_id: string;
  sequence_step: number;
  template_key: string;
  customers: {
    email: string | null;
    full_name: string | null;
  } | null;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function escapeHtml(input: string): string {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

interface Template {
  subject: string;
  heading: string;
  subheading: string;
  body: string[];
  ctaLabel: string;
  ctaPath: string;
}

/**
 * Keyed by the template_key that enqueue_portal_welcome_sequence_for_customer
 * writes. A key with no entry here is left pending rather than guessed at, so
 * adding a fourth step to the SQL without adding copy here is visible instead
 * of silently mailing something wrong.
 */
const TEMPLATES: Record<string, Template> = {
  portal_welcome_benefits: {
    subject: 'Welcome to your Boxed2Built client portal',
    heading: 'Your client portal is ready',
    subheading: 'Everything about your project, in one place.',
    body: [
      "Thanks for setting up your account. Your portal is where you can keep track of everything we're doing for you, whenever it suits you.",
      'Inside you can follow your project timeline and job status, review invoices, balances and payment history, and download documents and receipts any time.',
    ],
    ctaLabel: 'Open My Portal',
    ctaPath: '/portal/dashboard',
  },
  portal_how_to_use_jobs_invoices_support: {
    subject: 'Finding your jobs, invoices and support in the portal',
    heading: 'A quick tour of your portal',
    subheading: 'Three places worth knowing about.',
    body: [
      'Jobs shows every job we have on file for you, with its current status and scheduled dates. Open one to see the full scope, timeline and any attached documents.',
      'Invoices keeps your billing history together — what is outstanding, what is paid, and a receipt for each.',
      'Support is the quickest way to reach us about a specific job. Messages sent there come straight to us with the job already attached.',
    ],
    ctaLabel: 'View My Jobs',
    ctaPath: '/portal/jobs',
  },
  portal_complete_profile_contact_preferences: {
    subject: 'Finish setting up your Boxed2Built portal',
    heading: 'Two minutes to finish setting up',
    subheading: 'So we reach you the way you prefer.',
    body: [
      'Adding your phone number and confirming your contact details means we can reach you quickly when something about your job changes.',
      'You can also choose which updates you want emailed, and which you would rather just see in the portal. You can change that at any time.',
    ],
    ctaLabel: 'Update My Details',
    ctaPath: '/portal/profile',
  },
};

function buildHtml(template: Template, fullName: string | null): string {
  const firstName = escapeHtml((fullName?.trim() || 'there').split(' ')[0] || 'there');
  const paragraphs = template.body
    .map(
      (line) =>
        `<p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.7;">${escapeHtml(line)}</p>`,
    )
    .join('\n                ');

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
  </head>
  <body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
      <tr>
        <td align="center">
          <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
            <tr>
              <td style="background:#1e3a5f;padding:28px 32px;border-radius:12px 12px 0 0;">
                <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">${escapeHtml(template.heading)}</h1>
                <p style="margin:8px 0 0;color:#93c5fd;font-size:14px;">${escapeHtml(template.subheading)}</p>
              </td>
            </tr>
            <tr>
              <td style="background:#ffffff;padding:32px;">
                <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.7;">Hi ${firstName},</p>
                ${paragraphs}
                <p style="margin:24px 0;text-align:center;">
                  <a href="${APP_URL}${template.ctaPath}" style="display:inline-block;background:#2563eb;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:12px 22px;border-radius:8px;">${escapeHtml(template.ctaLabel)}</a>
                </p>
                <p style="margin:0;color:#6b7280;font-size:13px;line-height:1.6;">Prefer fewer emails? Change what we send you under <a href="${APP_URL}/portal/notifications" style="color:#2563eb;">notification settings</a> in your portal.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function buildPlainText(template: Template, fullName: string | null): string {
  const firstName = (fullName?.trim() || 'there').split(' ')[0] || 'there';

  return [
    `Hi ${firstName},`,
    '',
    ...template.body.flatMap((line) => [line, '']),
    `${template.ctaLabel}: ${APP_URL}${template.ctaPath}`,
    '',
    `Prefer fewer emails? Change what we send you at ${APP_URL}/portal/notifications`,
  ].join('\n');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ success: false, error: 'Method not allowed' }, 405);
  }

  if (!RESEND_API_KEY) {
    return json({ success: false, error: 'Email service is not configured.' }, 500);
  }

  try {
    // Mailing the business's customers is a scheduled job, so only the cron
    // caller (service role) or signed-in staff may trigger a run.
    const auth = await authorizeAdminOrService(req);
    if (!auth.ok) {
      return json({ success: false, error: auth.error ?? 'Unauthorized' }, auth.status ?? 401);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: due, error: dueError } = await supabase
      .from('portal_welcome_email_queue')
      .select('id, customer_id, sequence_step, template_key, customers ( email, full_name )')
      .eq('status', 'pending')
      .lte('scheduled_for', new Date().toISOString())
      .order('scheduled_for', { ascending: true })
      .limit(BATCH_SIZE);

    if (dueError) throw new Error(dueError.message);

    const rows = (due ?? []) as unknown as QueueRow[];
    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const row of rows) {
      const template = TEMPLATES[row.template_key];
      const email = row.customers?.email?.trim().toLowerCase() ?? '';

      // Left pending on purpose: an unknown template_key means the SQL grew a
      // step this function does not know about, and guessing at copy is worse
      // than the queue visibly not draining.
      if (!template) {
        console.error('No template for key:', row.template_key);
        continue;
      }

      if (!email) {
        await supabase
          .from('portal_welcome_email_queue')
          .update({ status: 'skipped', metadata: { reason: 'no_email' } })
          .eq('id', row.id);
        skipped += 1;
        continue;
      }

      // Onboarding is still marketing. Someone who has turned email off, or
      // unsubscribed outright, does not get these.
      const { data: prefs } = await supabase
        .from('customer_notification_preferences')
        .select('email_enabled, unsubscribed_at')
        .eq('customer_id', row.customer_id)
        .maybeSingle();

      if (prefs && (prefs.email_enabled === false || prefs.unsubscribed_at)) {
        await supabase
          .from('portal_welcome_email_queue')
          .update({ status: 'skipped', metadata: { reason: 'opted_out' } })
          .eq('id', row.id);
        skipped += 1;
        continue;
      }

      const now = new Date().toISOString();

      try {
        const resendRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: `Boxed2Built <${FROM_EMAIL}>`,
            to: [email],
            subject: template.subject,
            html: buildHtml(template, row.customers?.full_name ?? null),
            text: buildPlainText(template, row.customers?.full_name ?? null),
            reply_to: REPLY_TO_EMAIL,
          }),
        });

        if (!resendRes.ok) {
          // Logged server-side only; the upstream body is never relayed.
          console.error('Resend API error:', await resendRes.text());
          throw new Error('EMAIL_SEND_FAILED');
        }

        const resendData = await resendRes.json();
        const messageId: string = resendData?.id ?? '';

        await supabase
          .from('portal_welcome_email_queue')
          .update({ status: 'sent', sent_at: now, metadata: { email, message_id: messageId || null } })
          .eq('id', row.id);

        await supabase.from('email_events').insert({
          resend_event_id: messageId ? `send-${messageId}` : null,
          message_id: messageId || null,
          event_type: 'email.sent',
          recipient: email,
          subject: template.subject,
          from_address: FROM_EMAIL,
          occurred_at: now,
          payload: {
            source: 'send-portal-welcome-emails',
            customerId: row.customer_id,
            sequenceStep: row.sequence_step,
            templateKey: row.template_key,
          },
        });

        sent += 1;
      } catch (error) {
        // Marked failed rather than left pending, so one bad address cannot
        // have the batch retry it forever and starve the rest of the queue.
        await supabase
          .from('portal_welcome_email_queue')
          .update({
            status: 'failed',
            metadata: { email, error: error instanceof Error ? error.message : 'unknown' },
          })
          .eq('id', row.id);
        failed += 1;
      }
    }

    return json({ success: true, considered: rows.length, sent, skipped, failed });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to send portal welcome emails.';
    console.error('send-portal-welcome-emails error:', error);
    return json({ success: false, error: message }, 500);
  }
});
