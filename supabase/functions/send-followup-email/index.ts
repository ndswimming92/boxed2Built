import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { authorizeAdminOrService } from '../_shared/authorize.ts';
import { decideFollowup, isSendableEmail, type FollowupSkipReason } from '../_shared/customerFollowup.ts';

/**
 * The post-job thank-you: a Google review ask, a way back to a quote, and the
 * client's referral code. Fires automatically once a job's scheduled end time
 * passes; also sendable by hand from that job's card.
 *
 * POST with no body (how cron calls it) sweeps every job that is due.
 * POST {"jobId": "..."} judges one job and reports why it did or did not send.
 * POST {"jobId": "...", "preview": true} returns the rendered email and its
 *   send status without sending. This is what the admin console displays, so
 *   the preview is the same HTML the client would receive rather than a
 *   second copy of the template maintained in the browser.
 * POST {"jobId": "...", "force": true} sends now, overriding the timing guard.
 *   force is rejected without a jobId, since a forced sweep would re-mail
 *   every eligible customer at once.
 * POST {"jobId": "...", "test": true} sends the real email to the signed-in
 *   admin instead of the client. The recipient comes from the caller's own
 *   token, never from the request body — nothing here can be aimed at a
 *   third party. A test leaves the job's markers alone, so the client is
 *   still owed theirs.
 * POST {"dryRun": true} renders everything and sends nothing.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  // x-correlation-id / x-session-correlation-id are added to every request by
  // the Supabase client's fetch wrapper in src/lib/supabase.ts. A preflight
  // that does not allow them is rejected by the browser before the POST is
  // ever sent, which surfaces as "Failed to send a request to the Edge
  // Function" rather than as anything mentioning CORS.
  'Access-Control-Allow-Headers':
    'Content-Type, Authorization, X-Client-Info, Apikey, X-Correlation-Id, X-Session-Correlation-Id',
};

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const FROM_EMAIL = 'team@boxed2built.com';
// team@boxed2built.com cannot receive mail — it hard-bounces. This is the
// address that actually accepts replies.
const REPLY_TO_EMAIL = 'replies@reply.boxed2built.com';
const BCC_EMAIL = 'nicholas.davidson@boxed2built.com';
const WEBSITE_URL = 'https://boxed2built.com';
const CONTACT_URL = 'https://boxed2built.com/contact';
const REVIEW_URL = 'https://g.page/r/CW-qaf93r1ZuEAI/review';
const CONTACT_EMAIL = 'nicholas.davidson@boxed2built.com';

/** Used when the business has no booking settings row to read a timezone from. */
const DEFAULT_TIMEZONE = 'America/Chicago';

/**
 * How far back the sweep looks for jobs whose end time might be due. Bounded
 * deliberately tight: these columns start NULL on every job, including ones
 * completed months or years ago, and an unbounded sweep would read that as
 * every one of them being newly due. See the migration that added these
 * columns for the full reasoning.
 */
const LOOKBACK_DAYS = 3;

interface JobRow {
  id: string;
  business_id: string;
  client_id: string | null;
  client_name: string | null;
  client_email: string | null;
  job_status: string | null;
  is_active: boolean;
  date_scheduled: string | null;
  scheduled_end_time: string | null;
  follow_up_for_date: string | null;
  follow_up_for_end_time: string | null;
  follow_up_sent_at: string | null;
}

const JOB_COLUMNS =
  'id, business_id, client_id, client_name, client_email, job_status, is_active, ' +
  'date_scheduled, scheduled_end_time, follow_up_for_date, follow_up_for_end_time, follow_up_sent_at';

interface Payload {
  /** Judge or send for one job only. Omitted by cron, which sweeps everything due. */
  jobId?: string;
  /** Send now, overriding the timing guard. Requires jobId. */
  force?: boolean;
  /** Return the rendered email and its status without sending. Requires jobId. */
  preview?: boolean;
  /** Send the real email to the signed-in admin instead of the client. */
  test?: boolean;
  /** Render everything and send nothing. */
  dryRun?: boolean;
}

/** What the admin console needs to show a preview and a status line. */
interface PreviewPayload {
  subject: string;
  html: string;
  text: string;
  /** The client address this would go to, or null when there is not one. */
  recipient: string | null;
  status: 'due' | 'scheduled' | 'sent' | 'blocked';
  reason: FollowupSkipReason | null;
  /** ISO instant the follow-up is or was due; null when the job has no date/end time. */
  sendAt: string | null;
  /** ISO instant it actually went out, when it has. */
  sentAt: string | null;
  /** So the browser can render both instants on the business's clock. */
  timeZone: string;
}

interface SendOutcome {
  jobId: string;
  sent: boolean;
  reason?: FollowupSkipReason | 'send_failed' | 'dry_run';
  to?: string;
  subject?: string;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/** YYYY-MM-DD, `days` from now in UTC. Only ever used to bound the sweep. */
function utcDateOffset(now: Date, days: number): string {
  return new Date(now.getTime() + days * 86_400_000).toISOString().slice(0, 10);
}

function escapeHtml(input: string): string {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function buildReferralBlock(referralCode: string | null): string {
  if (!referralCode) return '';
  const code = escapeHtml(referralCode);
  return `
        <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:20px 24px;margin-bottom:24px;">
          <p style="margin:0 0 6px;color:#166534;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;">Your Personal Referral Code</p>
          <p style="margin:0 0 14px;font-size:32px;font-weight:800;color:#15803d;font-family:monospace;letter-spacing:3px;">${code}</p>
          <p style="margin:0 0 10px;color:#374151;font-size:14px;line-height:1.6;">Know someone who could use a hand? If they book a job and mention your code, <strong>you both get $25 off</strong> — no strings attached.</p>
          <p style="margin:0;color:#15803d;font-size:12px;font-weight:600;">No limit on how many people you can refer.</p>
        </div>`;
}

function buildHtml(clientName: string, referralCode: string | null): string {
  const firstName = escapeHtml((clientName.trim() || 'there').split(' ')[0] || 'there');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

      <tr><td style="background:#1e3a5f;padding:28px 32px;border-radius:12px 12px 0 0;">
        <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">Thanks for trusting me with your home, ${firstName}!</h1>
        <p style="margin:8px 0 0;color:#93c5fd;font-size:14px;">It was genuinely great working with you.</p>
      </td></tr>

      <tr><td style="background:#ffffff;padding:32px;">
        <p style="margin:0 0 20px;color:#374151;font-size:15px;line-height:1.7;">Hi ${firstName},</p>
        <p style="margin:0 0 20px;color:#374151;font-size:15px;line-height:1.7;">I really appreciate you choosing Boxed2Built. I hope the space feels exactly the way you imagined — one less thing on your plate and your home feeling a little more complete.</p>

        <div style="background:#f0f7ff;border:1px solid #bfdbfe;border-radius:8px;padding:20px 24px;margin-bottom:24px;text-align:center;">
          <p style="margin:0 0 6px;color:#1e3a5f;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;">Would you leave me a Google review?</p>
          <p style="margin:0 0 18px;color:#374151;font-size:14px;line-height:1.6;">As a small local business, reviews mean everything to me. If I earned it, a quick review takes less than 30 seconds and helps more than you know.</p>
          <a href="${REVIEW_URL}" style="display:inline-block;background:#1e3a5f;color:#ffffff;font-size:13px;font-weight:600;text-decoration:none;padding:11px 24px;border-radius:6px;">Leave a Google Review &rarr;</a>
        </div>

        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:20px 24px;margin-bottom:24px;">
          <p style="margin:0 0 12px;color:#111827;font-size:14px;font-weight:700;">Need help again down the road?</p>
          <p style="margin:0 0 18px;color:#374151;font-size:14px;line-height:1.7;">Whether it's another piece of furniture, a TV to mount, or anything else you need set up — just reply to this email or request a quote anytime. I'm always happy to come back.</p>
          <div style="text-align:center;">
            <a href="${CONTACT_URL}" style="display:inline-block;background:#1e3a5f;color:#ffffff;font-size:13px;font-weight:600;text-decoration:none;padding:11px 24px;border-radius:6px;">Request a Quote &rarr;</a>
          </div>
        </div>

        ${buildReferralBlock(referralCode)}
        <p style="margin:0 0 20px;color:#374151;font-size:15px;line-height:1.7;">Feel free to save my number in case you need help again down the road: <span style="color:#111827;font-weight:600;">(615) 403-4538</span></p>
        <p style="margin:0 0 4px;color:#374151;font-size:15px;font-weight:600;">Nicholas Davidson</p>
        <p style="margin:0 0 2px;color:#6b7280;font-size:14px;">Owner, Boxed2Built</p>
        <p style="margin:0 0 2px;color:#6b7280;font-size:14px;">(615) 403-4538</p>
        <p style="margin:0;color:#6b7280;font-size:14px;"><a href="mailto:${CONTACT_EMAIL}" style="color:#6b7280;text-decoration:underline;">${CONTACT_EMAIL}</a></p>
      </td></tr>

      <tr><td style="background:#f9fafb;padding:20px 32px;border-radius:0 0 12px 12px;border-top:1px solid #e5e7eb;">
        <p style="margin:0 0 8px;color:#9ca3af;font-size:12px;text-align:center;">
          Boxed2Built &bull; Spring Hill, TN &bull;
          <a href="${WEBSITE_URL}" style="color:#9ca3af;text-decoration:underline;">boxed2built.com</a>
        </p>
        <p style="margin:0;color:#9ca3af;font-size:11px;text-align:center;line-height:1.7;">
          <a href="${WEBSITE_URL}/privacy-policy" style="color:#9ca3af;text-decoration:underline;">Privacy Policy</a>
          &nbsp;&bull;&nbsp;
          <a href="${WEBSITE_URL}/terms-of-service" style="color:#9ca3af;text-decoration:underline;">Terms of Service</a>
          &nbsp;&bull;&nbsp;
          <a href="mailto:${CONTACT_EMAIL}" style="color:#9ca3af;text-decoration:underline;">${CONTACT_EMAIL}</a>
        </p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body></html>`;
}

function buildPlainText(clientName: string, referralCode: string | null): string {
  const firstName = (clientName.trim() || 'there').split(' ')[0] || 'there';
  const lines = [
    `Hi ${firstName},`,
    '',
    'I really appreciate you choosing Boxed2Built. I hope the space feels exactly the way you imagined — one less thing on your plate and your home feeling a little more complete.',
    '',
    '--- Would you leave me a Google review? ---',
    'As a small local business, reviews mean everything to me. If I earned it, it only takes 30 seconds:',
    REVIEW_URL,
    '',
    '--- Need help again down the road? ---',
    'Whether it\'s another piece of furniture, a TV to mount, or anything else you need set up — just reply to this email or request a quote anytime:',
    CONTACT_URL,
    '',
  ];

  if (referralCode) {
    lines.push(
      '--- Your Personal Referral Code ---',
      `Your code: ${referralCode}`,
      '',
      'Know someone who could use a hand? If they book a job and mention your code, you both get $25 off — no strings attached.',
      '',
      'No limit on how many people you can refer.',
      '',
    );
  }

  lines.push(
    'Feel free to save my number in case you need help again down the road: (615) 403-4538',
    '',
    'Nicholas Davidson',
    'Owner, Boxed2Built',
    '(615) 403-4538',
    CONTACT_EMAIL,
    '',
    'Boxed2Built | Spring Hill, TN',
    WEBSITE_URL,
    '',
    'Privacy Policy: ' + WEBSITE_URL + '/privacy-policy',
    'Terms of Service: ' + WEBSITE_URL + '/terms-of-service',
  );

  return lines.join('\n');
}

async function loadTimeZone(supabase: SupabaseClient, businessId: string): Promise<string> {
  // Job times are bare local times; they only mean something against the
  // business timezone the booking page already configures.
  const { data } = await supabase
    .from('booking_settings')
    .select('timezone')
    .eq('business_id', businessId)
    .maybeSingle<{ timezone: string | null }>();
  return data?.timezone?.trim() || DEFAULT_TIMEZONE;
}

async function loadReferralCode(supabase: SupabaseClient, clientId: string | null): Promise<string | null> {
  if (!clientId) return null;
  const { data } = await supabase
    .from('clients')
    .select('referral_code')
    .eq('id', clientId)
    .maybeSingle<{ referral_code: string | null }>();
  return data?.referral_code ?? null;
}

async function sendFollowup(
  supabase: SupabaseClient,
  job: JobRow,
  referralCode: string | null,
  now: Date,
  dryRun: boolean,
  /** A test send goes to the admin and must not touch the job's or client's markers. */
  testRecipient?: string,
): Promise<SendOutcome> {
  const recipient = testRecipient ?? job.client_email!.trim();
  const subject = 'Thank You from Boxed2Built';
  const html = buildHtml(job.client_name ?? '', referralCode);
  const text = buildPlainText(job.client_name ?? '', referralCode);

  if (dryRun) {
    return { jobId: job.id, sent: false, reason: 'dry_run', to: recipient, subject };
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `Boxed2Built <${FROM_EMAIL}>`,
      to: [recipient],
      ...(testRecipient ? {} : { bcc: [BCC_EMAIL] }),
      subject,
      html,
      text,
      reply_to: REPLY_TO_EMAIL,
    }),
  });

  if (!res.ok) {
    console.error('send-followup-email: Resend rejected the send', job.id, res.status, await res.text());
    return { jobId: job.id, sent: false, reason: 'send_failed', to: recipient };
  }

  // A test copy went to the admin, not the client, so the client is still
  // owed their follow-up and the markers must not move.
  if (testRecipient) {
    return { jobId: job.id, sent: true, to: recipient, subject };
  }

  const resendData = await res.json();
  const messageId: string = resendData?.id ?? '';
  const nowIso = now.toISOString();

  // Only now advance the markers: a failed send above must stay re-sendable
  // on the next tick.
  const { error } = await supabase
    .from('jobs')
    .update({
      follow_up_for_date: job.date_scheduled,
      follow_up_for_end_time: job.scheduled_end_time,
      follow_up_sent_at: nowIso,
    })
    .eq('id', job.id);
  if (error) {
    // The email is already out; log rather than report a failure that would
    // send the client a second copy next hour.
    console.error('send-followup-email: failed to record follow-up state', job.id, error);
  }

  // Kept in step so the Clients page's "Follow-up email" badge, which reads
  // this column, still reflects reality now that sends are job-driven.
  if (job.client_id) {
    const { error: clientError } = await supabase
      .from('clients')
      .update({ last_followup_email_sent_at: nowIso })
      .eq('id', job.client_id);
    if (clientError) {
      console.error('send-followup-email: failed to update client marker', job.client_id, clientError);
    }
  }

  await supabase.from('email_events').insert({
    resend_event_id: messageId ? `send-${messageId}` : null,
    message_id: messageId || null,
    event_type: 'email.sent',
    recipient,
    subject,
    from_address: FROM_EMAIL,
    occurred_at: nowIso,
    payload: {
      source: 'send-followup-email',
      jobId: job.id,
      clientId: job.client_id,
      clientName: job.client_name,
    },
  });

  return { jobId: job.id, sent: true, to: recipient, subject };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ success: false, error: 'Method not allowed' }, 405);
  }

  const auth = await authorizeAdminOrService(req);
  if (!auth.ok) {
    return json({ success: false, error: auth.error ?? 'Unauthorized' }, auth.status ?? 401);
  }

  if (!RESEND_API_KEY) {
    return json({ success: false, error: 'Email service is not configured.' }, 500);
  }

  // Cron posts {"trigger":"cron"}; a manual call may post nothing at all.
  let payload: Payload = {};
  try {
    payload = (await req.json()) as Payload;
  } catch {
    payload = {};
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const now = new Date();
  const jobId = payload.jobId?.trim();

  // force means "send now regardless of timing". Across a whole sweep it
  // would mean mailing every eligible client at once, which is never what
  // anyone wants, so it has to name its job. Same for the single-job-only modes.
  for (const [flag, label] of [[payload.force, 'force'], [payload.preview, 'preview'], [payload.test, 'test']] as const) {
    if (flag && !jobId) {
      return json({ success: false, error: `${label} requires a jobId.` }, 400);
    }
  }

  // A test copy goes to whoever is signed in, read from their own token.
  // There is deliberately no recipient parameter: a body-supplied address
  // would turn this into a way to mail arbitrary people from the business's
  // domain.
  if (payload.test && !auth.user?.email) {
    return json(
      { success: false, error: 'A test send needs a signed-in admin with an email address.' },
      400,
    );
  }

  let query = supabase.from('jobs').select(JOB_COLUMNS);
  if (jobId) {
    // No eligibility filters here: decideFollowup reports *why* a named job
    // is not getting an email, which is the whole value of asking about one.
    query = query.eq('id', jobId);
  } else {
    query = query
      .eq('is_active', true)
      .in('job_status', ['scheduled', 'accepted', 'in_progress', 'completed'])
      .gte('date_scheduled', utcDateOffset(now, -LOOKBACK_DAYS))
      .lte('date_scheduled', utcDateOffset(now, 0));
  }

  const { data: jobs, error: jobsError } = await query.returns<JobRow[]>();

  if (jobsError) {
    console.error('send-followup-email: job lookup failed', jobsError);
    return json({ success: false, error: 'Failed to load jobs' }, 500);
  }
  if (jobId && !jobs?.length) {
    return json({ success: false, error: 'Job not found' }, 404);
  }

  const timeZones = new Map<string, string>();
  const outcomes: SendOutcome[] = [];

  for (const job of jobs ?? []) {
    let timeZone = timeZones.get(job.business_id);
    if (!timeZone) {
      timeZone = await loadTimeZone(supabase, job.business_id);
      timeZones.set(job.business_id, timeZone);
    }

    const decision = decideFollowup(
      {
        dateScheduled: job.date_scheduled,
        scheduledEndTime: job.scheduled_end_time,
        clientEmail: job.client_email,
        isActive: job.is_active,
        jobStatus: job.job_status,
        followUpForDate: job.follow_up_for_date,
        followUpForEndTime: job.follow_up_for_end_time,
      },
      {
        now,
        timeZone,
        // A test copy goes to the admin, so the timing guard is beside the
        // point — it protects the client's inbox, not this one. A preview
        // never forces: its whole job is to report the real status.
        force: !payload.preview && (payload.force || payload.test),
      },
    );

    if (payload.preview) {
      // A preview answers "what would this look like, and when does it go?",
      // so it renders even for a job the guard would refuse — seeing the
      // email is how you work out what to fix.
      const referralCode = await loadReferralCode(supabase, job.client_id);
      const subject = 'Thank You from Boxed2Built';
      const html = buildHtml(job.client_name ?? '', referralCode);
      const text = buildPlainText(job.client_name ?? '', referralCode);

      const reason = decision.send ? null : decision.reason;
      const status: PreviewPayload['status'] = reason === null
        ? 'due'
        : reason === 'already_sent'
          ? 'sent'
          : reason === 'too_early'
            ? 'scheduled'
            : 'blocked';

      return json({
        success: true,
        preview: {
          subject,
          html,
          text,
          recipient: isSendableEmail(job.client_email) ? job.client_email!.trim() : null,
          status,
          reason,
          sendAt: decision.sendAt?.toISOString() ?? null,
          sentAt: job.follow_up_sent_at,
          timeZone,
        } satisfies PreviewPayload,
      });
    }

    if (!decision.send) {
      outcomes.push({ jobId: job.id, sent: false, reason: decision.reason });
      continue;
    }

    const referralCode = await loadReferralCode(supabase, job.client_id);
    outcomes.push(
      await sendFollowup(
        supabase,
        job,
        referralCode,
        now,
        payload.dryRun === true,
        payload.test ? auth.user!.email! : undefined,
      ),
    );
  }

  const sent = outcomes.filter((outcome) => outcome.sent).length;
  const failed = outcomes.filter((outcome) => outcome.reason === 'send_failed').length;

  if (sent || failed) {
    console.log(`send-followup-email: ${sent} sent, ${failed} failed, ${outcomes.length} considered`);
  }

  // A sweep over a quiet week is mostly skips, so it reports only the news.
  // An explicit jobId or dryRun call is a question about specific jobs and
  // gets every row back, skip reasons included.
  const verbose = Boolean(jobId) || payload.dryRun === true;

  return json({
    success: true,
    considered: outcomes.length,
    sent,
    failed,
    dryRun: payload.dryRun === true,
    results: verbose
      ? outcomes
      : outcomes.filter((outcome) => outcome.sent || outcome.reason === 'send_failed'),
  });
});
