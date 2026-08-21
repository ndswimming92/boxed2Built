import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { authorizeAdminOrService } from '../_shared/authorize.ts';
import { buildIcsCalendar, icsToBase64, type IcsEvent } from '../_shared/ics.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const FROM_EMAIL = 'team@boxed2built.com';
const SITE_URL = Deno.env.get('SITE_URL') ?? 'https://boxed2built.com';
const ADMIN_JOBS_URL = `${SITE_URL}/admin/jobs`;

/**
 * Where the "you have a job scheduled" email lands. This is an internal
 * notification, never the customer — falls back to the business contact address.
 */
const NOTIFY_EMAIL_OVERRIDE = Deno.env.get('JOB_SCHEDULE_NOTIFY_EMAIL');

/**
 * Jobs are scheduled by date, so the event is all-day and DTSTART is local
 * midnight. Triggers are relative to that: -PT15H lands at 9:00am the day
 * before, PT7H at 7:00am on the day itself.
 */
const ALARM_DAY_BEFORE = Deno.env.get('JOB_SCHEDULE_ALARM_DAY_BEFORE') ?? '-PT15H';
const ALARM_DAY_OF = Deno.env.get('JOB_SCHEDULE_ALARM_DAY_OF') ?? 'PT7H';

interface Payload {
  jobId?: string;
  /** Re-send even when this exact date was already notified (manual "resend" button). */
  force?: boolean;
}

function escapeHtml(input: string): string {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/** 2026-08-25 -> Tuesday, August 25, 2026. Parsed as UTC so the date never slips a day. */
function formatLongDate(date: string): string {
  const [year, month, day] = date.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

interface JobRow {
  id: string;
  organization_id: string | null;
  business_id: string;
  client_name: string;
  client_phone: string | null;
  client_email: string | null;
  client_address: string | null;
  service_address: string | null;
  job_type: string | null;
  job_description: string | null;
  date_scheduled: string | null;
  location_city: string | null;
  quoted_price: number | null;
  notes: string | null;
  is_active: boolean;
  schedule_notified_for: string | null;
  schedule_ics_sequence: number | null;
}

/** "Same as client address" is stored as a null service address. */
function resolveLocation(job: JobRow): string {
  const address = job.service_address?.trim() || job.client_address?.trim();
  if (address) return address.replace(/\s*\n\s*/g, ', ');
  return job.location_city?.trim() || '';
}

function buildEventDescription(job: JobRow, location: string): string {
  const parts: string[] = [`Client: ${job.client_name}`];
  if (job.client_phone) parts.push(`Phone: ${job.client_phone}`);
  if (job.client_email) parts.push(`Email: ${job.client_email}`);
  if (location) parts.push(`Where: ${location}`);
  if (job.job_description) parts.push('', job.job_description.trim());
  if (job.notes) parts.push('', `Notes: ${job.notes.trim()}`);
  parts.push('', `Open in admin: ${ADMIN_JOBS_URL}`);
  return parts.join('\n');
}

/** Plain-text alternative. Sending html without it hurts deliverability. */
function buildEmailText(job: JobRow, location: string, isReschedule: boolean): string {
  const prettyDate = formatLongDate(job.date_scheduled!);
  const jobType = job.job_type?.trim() || 'Job';
  const lines = [
    `${isReschedule ? 'Job rescheduled' : 'Job scheduled'}: ${prettyDate}`,
    '',
    `Client: ${job.client_name}`,
    `Job type: ${jobType}`,
  ];
  if (location) lines.push(`Where: ${location}`);
  if (job.client_phone) lines.push(`Phone: ${job.client_phone}`);
  if (job.client_email) lines.push(`Email: ${job.client_email}`);
  if (typeof job.quoted_price === 'number') lines.push(`Quoted: $${job.quoted_price.toFixed(2)}`);
  if (job.job_description) lines.push('', job.job_description.trim());
  lines.push(
    '',
    'The attached job.ics adds this to your calendar, with reminders the morning before and the morning of.',
    '',
    `Open job in admin: ${ADMIN_JOBS_URL}`,
  );
  return lines.join('\n');
}

function buildEmailHtml(job: JobRow, location: string, isReschedule: boolean): string {
  const prettyDate = formatLongDate(job.date_scheduled!);
  const jobType = job.job_type?.trim() || 'Job';
  const heading = isReschedule ? 'Job rescheduled' : 'Job scheduled';
  const rows: Array<[string, string]> = [
    ['Client', job.client_name],
    ['Job type', jobType],
    ['Date', prettyDate],
  ];
  if (location) rows.push(['Where', location]);
  if (job.client_phone) rows.push(['Phone', job.client_phone]);
  if (job.client_email) rows.push(['Email', job.client_email]);
  if (typeof job.quoted_price === 'number') rows.push(['Quoted', `$${job.quoted_price.toFixed(2)}`]);

  const rowsHtml = rows
    .map(
      ([label, value]) => `
          <tr>
            <td style="padding:8px 0;color:#6b7280;font-size:13px;width:110px;vertical-align:top;">${escapeHtml(label)}</td>
            <td style="padding:8px 0;color:#111827;font-size:14px;font-weight:600;">${escapeHtml(value)}</td>
          </tr>`,
    )
    .join('');

  const descriptionHtml = job.job_description
    ? `<p style="margin:20px 0 0;color:#374151;font-size:14px;line-height:1.7;">${escapeHtml(job.job_description.trim())}</p>`
    : '';

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

      <tr><td style="background:#1e3a5f;padding:28px 32px;border-radius:12px 12px 0 0;">
        <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">${escapeHtml(heading)}: ${escapeHtml(prettyDate)}</h1>
        <p style="margin:8px 0 0;color:#93c5fd;font-size:14px;">${escapeHtml(jobType)} for ${escapeHtml(job.client_name)}</p>
      </td></tr>

      <tr><td style="background:#ffffff;padding:32px;">

        <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:18px 22px;margin-bottom:24px;">
          <p style="margin:0 0 6px;color:#166534;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;">Add to your calendar</p>
          <p style="margin:0;color:#374151;font-size:14px;line-height:1.6;">Open the attached <strong>job.ics</strong> file on this device and your calendar app will file it, with reminders set for the morning before and the morning of.</p>
        </div>

        <table width="100%" cellpadding="0" cellspacing="0">${rowsHtml}</table>
        ${descriptionHtml}

        <div style="text-align:center;margin-top:28px;">
          <a href="${ADMIN_JOBS_URL}" style="display:inline-block;background:#1e3a5f;color:#ffffff;font-size:13px;font-weight:600;text-decoration:none;padding:11px 24px;border-radius:6px;">Open job in admin &rarr;</a>
        </div>

      </td></tr>

      <tr><td style="background:#ffffff;padding:0 32px 28px;border-radius:0 0 12px 12px;">
        <p style="margin:0;padding-top:18px;border-top:1px solid #e5e7eb;color:#9ca3af;font-size:12px;line-height:1.6;">
          Sent automatically by Boxed2Built when a job gets a scheduled date. Reschedule the job and this event updates itself &mdash; it will not create a duplicate.
        </p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body></html>`;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ success: false, error: 'Method not allowed' }, 405);
  }

  const auth = await authorizeAdminOrService(req);
  if (!auth.ok) {
    return json({ success: false, error: auth.error ?? 'Unauthorized' }, auth.status ?? 401);
  }

  if (!RESEND_API_KEY) {
    return json({ success: false, error: 'Email is not configured (RESEND_API_KEY missing).' }, 500);
  }

  let payload: Payload;
  try {
    payload = await req.json();
  } catch {
    return json({ success: false, error: 'Invalid JSON body' }, 400);
  }

  const jobId = payload.jobId?.trim();
  if (!jobId) {
    return json({ success: false, error: 'jobId is required' }, 400);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .select(
      'id, organization_id, business_id, client_name, client_phone, client_email, client_address, ' +
        'service_address, job_type, job_description, date_scheduled, location_city, quoted_price, ' +
        'notes, is_active, schedule_notified_for, schedule_ics_sequence',
    )
    .eq('id', jobId)
    .maybeSingle<JobRow>();

  if (jobError) {
    console.error('send-job-schedule-email: job lookup failed', jobError);
    return json({ success: false, error: 'Failed to load job' }, 500);
  }
  if (!job) {
    return json({ success: false, error: 'Job not found' }, 404);
  }

  // Nothing to put on a calendar until a date exists, and archived jobs are not news.
  if (!job.date_scheduled) {
    // Reset the marker so re-scheduling later — even back to the same date —
    // still sends. Note this does not retract an invite already filed; the
    // subscribed feed is what drops an unscheduled job automatically.
    if (job.schedule_notified_for !== null) {
      const { error: clearError } = await supabase
        .from('jobs')
        .update({ schedule_notified_for: null, schedule_notified_at: null })
        .eq('id', job.id);
      if (clearError) {
        console.error('send-job-schedule-email: failed to clear notification state', clearError);
      }
    }
    return json({ success: true, skipped: true, reason: 'no_scheduled_date' });
  }
  if (!job.is_active) {
    return json({ success: true, skipped: true, reason: 'job_inactive' });
  }

  // The guard that makes this safe to call on every save: only a date that
  // differs from the one already notified produces another email.
  const isReschedule = job.schedule_notified_for !== null;
  if (!payload.force && job.schedule_notified_for === job.date_scheduled) {
    return json({ success: true, skipped: true, reason: 'already_notified' });
  }

  const { data: business } = await supabase
    .from('business_info')
    .select('name, email')
    .eq('id', job.business_id)
    .maybeSingle<{ name: string | null; email: string | null }>();

  const recipient = NOTIFY_EMAIL_OVERRIDE?.trim() || business?.email?.trim();
  if (!recipient) {
    return json({ success: false, error: 'No notification address configured for this business.' }, 500);
  }

  const location = resolveLocation(job);
  const jobType = job.job_type?.trim() || 'Job';
  // UID is derived from the job id and never changes, so a reschedule replaces
  // the calendar entry the earlier email created instead of adding a second one.
  const event: IcsEvent = {
    uid: `job-${job.id}@boxed2built.com`,
    sequence: (job.schedule_ics_sequence ?? 0) + 1,
    startDate: job.date_scheduled,
    summary: `${jobType} — ${job.client_name}`,
    description: buildEventDescription(job, location),
    location: location || undefined,
    url: ADMIN_JOBS_URL,
    alarms: [
      { trigger: ALARM_DAY_BEFORE, description: `Tomorrow: ${jobType} for ${job.client_name}` },
      { trigger: ALARM_DAY_OF, description: `Today: ${jobType} for ${job.client_name}` },
    ],
  };

  const ics = buildIcsCalendar([event], { method: 'PUBLISH' });
  const prettyDate = formatLongDate(job.date_scheduled);
  const subjectPrefix = isReschedule ? 'Rescheduled' : 'Scheduled';

  const emailResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `${business?.name?.trim() || 'Boxed2Built'} <${FROM_EMAIL}>`,
      to: [recipient],
      subject: `${subjectPrefix}: ${jobType} for ${job.client_name} — ${prettyDate}`,
      html: buildEmailHtml(job, location, isReschedule),
      text: buildEmailText(job, location, isReschedule),
      reply_to: FROM_EMAIL,
      attachments: [
        {
          filename: 'job.ics',
          content: icsToBase64(ics),
          content_type: 'text/calendar; charset=utf-8; method=PUBLISH',
        },
      ],
    }),
  });

  if (!emailResponse.ok) {
    const detail = await emailResponse.text();
    console.error('send-job-schedule-email: Resend rejected the send', emailResponse.status, detail);
    return json({ success: false, error: 'Failed to send calendar email.' }, 502);
  }

  const sentAt = new Date().toISOString();

  // Only now advance the markers: a failed send above must stay re-sendable.
  const { error: updateError } = await supabase
    .from('jobs')
    .update({
      schedule_notified_for: job.date_scheduled,
      schedule_notified_at: sentAt,
      schedule_ics_sequence: event.sequence,
    })
    .eq('id', job.id);

  if (updateError) {
    // The email is already out; log and still report success rather than
    // inviting a retry that would send a second copy.
    console.error('send-job-schedule-email: failed to record notification state', updateError);
  }

  if (job.organization_id) {
    const { error: notificationError } = await supabase.from('admin_notifications').insert({
      organization_id: job.organization_id,
      type: 'job_scheduled',
      title: `${subjectPrefix}: ${jobType} for ${job.client_name}`,
      body: `${prettyDate}${location ? ` — ${location}` : ''}. Calendar invite emailed to ${recipient}.`,
      link: '/admin/jobs',
      metadata: { job_id: job.id, date_scheduled: job.date_scheduled },
    });
    if (notificationError) {
      console.error('send-job-schedule-email: failed to create admin notification', notificationError);
    }
  }

  return json({ success: true, sentAt, sentTo: recipient, rescheduled: isReschedule });
});
