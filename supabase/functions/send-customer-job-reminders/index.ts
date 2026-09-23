import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { authorizeAdminOrService } from '../_shared/authorize.ts';
import { icsToBase64 } from '../_shared/ics.ts';
import {
  DEFAULT_SEND_HOUR,
  decideReminder,
  type ReminderSkipReason,
} from '../_shared/customerReminder.ts';
import {
  renderCustomerReminder,
  type ReminderBusiness,
  type ReminderJob,
} from '../_shared/customerReminderEmail.ts';

/**
 * Emails the customer about their upcoming job: the date, the arrival time, the
 * address to confirm, what to have ready, the estimate, and a calendar
 * attachment. Sent at 5pm local the day before.
 *
 * Not to be confused with send-job-schedule-email, which fires when a job gets
 * a date and goes to the business, not the customer.
 *
 * POST with no body (how cron calls it) sweeps every job that is due.
 * POST {"jobId": "..."} judges one job and reports why it did or did not send.
 * POST {"jobId": "...", "force": true} re-sends one the customer already got.
 *   force is rejected without a jobId, since a forced sweep would re-mail every
 *   upcoming customer.
 * POST {"dryRun": true} renders everything and sends nothing.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const FROM_EMAIL = 'team@boxed2built.com';
const SITE_URL = (Deno.env.get('SITE_URL') ?? 'https://boxed2built.com').replace(/\/+$/, '');

/** Local wall clock, the day before, that the reminder aims for. */
const SEND_HOUR = Deno.env.get('CUSTOMER_REMINDER_SEND_HOUR') ?? DEFAULT_SEND_HOUR;

/** Used when the business has no booking settings row to read a timezone from. */
const DEFAULT_TIMEZONE = 'America/Chicago';

/**
 * How wide a net the hourly sweep casts before `decideReminder` judges each job
 * precisely. A reminder is only ever due within a day of the job, but the
 * business timezone is not known until the job's row is in hand, so the window
 * is padded on both sides rather than computed per zone.
 */
const LOOKBACK_DAYS = 1;
const LOOKAHEAD_DAYS = 2;

/** The rendering fields, plus the ones only the sweep and the guards care about. */
interface JobRow extends ReminderJob {
  business_id: string;
  date_scheduled: string;
  client_email: string | null;
  job_status: string | null;
  is_active: boolean;
  customer_reminder_for: string | null;
  customer_reminder_start_time: string | null;
}

const JOB_COLUMNS =
  'id, business_id, client_name, client_email, client_address, service_address, job_type, ' +
  'job_description, date_scheduled, scheduled_start_time, scheduled_end_time, location_city, ' +
  'quoted_price, job_status, is_active, customer_reminder_for, customer_reminder_start_time, ' +
  'customer_reminder_ics_sequence';

interface Payload {
  /** Send for one job only. Omitted by cron, which sweeps everything due. */
  jobId?: string;
  /** Re-send even when this exact date and time were already covered. */
  force?: boolean;
  /** Render everything and send nothing. */
  dryRun?: boolean;
}

interface SendOutcome {
  jobId: string;
  sent: boolean;
  reason?: ReminderSkipReason | 'send_failed' | 'dry_run';
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

/** "(423) 368-3950" from whatever shape the business row holds. */
function formatPhoneDisplay(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  const local = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  return local.length === 10
    ? `(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`
    : phone;
}

function toTelHref(phone: string): string {
  const normalized = phone.replace(/[^\d+]/g, '');
  if (normalized.startsWith('+')) return normalized;
  const digits = normalized.replace(/\D/g, '');
  return digits.length === 10 ? `+1${digits}` : digits;
}

async function loadBusinessContext(
  supabase: SupabaseClient,
  businessId: string,
): Promise<ReminderBusiness> {
  const [{ data: business }, { data: settings }, { data: methods }] = await Promise.all([
    supabase
      .from('business_info')
      .select('name, email, phone')
      .eq('id', businessId)
      .maybeSingle<{ name: string | null; email: string | null; phone: string | null }>(),
    // Job times are bare local times; they only mean something against the
    // business timezone the booking page already configures.
    supabase
      .from('booking_settings')
      .select('timezone')
      .eq('business_id', businessId)
      .maybeSingle<{ timezone: string | null }>(),
    supabase
      .from('payment_methods')
      .select('method_name')
      .eq('business_id', businessId)
      .eq('is_active', true)
      .order('display_order'),
  ]);

  const phone = business?.phone?.trim() || null;

  return {
    name: business?.name?.trim() || 'Boxed2Built',
    email: business?.email?.trim() || null,
    phone: phone ? formatPhoneDisplay(phone) : null,
    phoneHref: phone ? toTelHref(phone) : null,
    timeZone: settings?.timezone?.trim() || DEFAULT_TIMEZONE,
    paymentMethods: (methods ?? [])
      .map((row: { method_name: string | null }) => row.method_name?.trim())
      .filter((name: string | undefined): name is string => Boolean(name)),
  };
}

async function sendReminder(
  supabase: SupabaseClient,
  job: JobRow,
  business: ReminderBusiness,
  now: Date,
  dryRun: boolean,
): Promise<SendOutcome> {
  const recipient = job.client_email!.trim();

  // Rendered before the dry-run branch on purpose: a dry run that skipped this
  // would not catch the thing it is most useful for catching.
  const email = renderCustomerReminder(job, business, { now, siteUrl: SITE_URL });

  if (dryRun) {
    return { jobId: job.id, sent: false, reason: 'dry_run', to: recipient, subject: email.subject };
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `${business.name} <${FROM_EMAIL}>`,
      to: [recipient],
      subject: email.subject,
      html: email.html,
      text: email.text,
      // Replies belong in the inbox the business actually reads.
      reply_to: business.email ?? FROM_EMAIL,
      attachments: [
        {
          filename: 'appointment.ics',
          content: icsToBase64(email.ics),
          content_type: 'text/calendar; charset=utf-8; method=PUBLISH',
        },
      ],
    }),
  });

  if (!response.ok) {
    console.error(
      'send-customer-job-reminders: Resend rejected the send',
      job.id,
      response.status,
      await response.text(),
    );
    return { jobId: job.id, sent: false, reason: 'send_failed', to: recipient };
  }

  // Only now advance the markers: a failed send above must stay re-sendable on
  // the next tick.
  const { error } = await supabase
    .from('jobs')
    .update({
      customer_reminder_for: job.date_scheduled,
      customer_reminder_start_time: job.scheduled_start_time,
      customer_reminder_sent_at: now.toISOString(),
      customer_reminder_ics_sequence: (job.customer_reminder_ics_sequence ?? 0) + 1,
    })
    .eq('id', job.id);

  if (error) {
    // The email is already out; log rather than report a failure that would
    // send the customer a second copy next hour.
    console.error('send-customer-job-reminders: failed to record reminder state', job.id, error);
  }

  return { jobId: job.id, sent: true, to: recipient, subject: email.subject };
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

  // force means "send this one again even though the customer already got it".
  // Across a whole sweep it would mean re-mailing every customer in the window,
  // which is never what anyone wants, so it has to name its job.
  if (payload.force && !jobId) {
    return json(
      { success: false, error: 'force requires a jobId — it would otherwise re-send to every upcoming customer.' },
      400,
    );
  }

  let query = supabase.from('jobs').select(JOB_COLUMNS);
  if (jobId) {
    // No eligibility filters here: decideReminder reports *why* a named job is
    // not getting an email, which is the whole value of asking about one.
    query = query.eq('id', jobId);
  } else {
    query = query
      .eq('is_active', true)
      .in('job_status', ['scheduled', 'accepted'])
      .gte('date_scheduled', utcDateOffset(now, -LOOKBACK_DAYS))
      .lte('date_scheduled', utcDateOffset(now, LOOKAHEAD_DAYS));
  }

  const { data: jobs, error: jobsError } = await query.returns<JobRow[]>();

  if (jobsError) {
    console.error('send-customer-job-reminders: job lookup failed', jobsError);
    return json({ success: false, error: 'Failed to load jobs' }, 500);
  }
  if (jobId && !jobs?.length) {
    return json({ success: false, error: 'Job not found' }, 404);
  }

  const businesses = new Map<string, ReminderBusiness>();
  const outcomes: SendOutcome[] = [];

  for (const job of jobs ?? []) {
    let business = businesses.get(job.business_id);
    if (!business) {
      business = await loadBusinessContext(supabase, job.business_id);
      businesses.set(job.business_id, business);
    }

    const decision = decideReminder(
      {
        dateScheduled: job.date_scheduled,
        scheduledStartTime: job.scheduled_start_time,
        clientEmail: job.client_email,
        isActive: job.is_active,
        jobStatus: job.job_status,
        reminderFor: job.customer_reminder_for,
        reminderStartTime: job.customer_reminder_start_time,
      },
      { now, timeZone: business.timeZone, sendHour: SEND_HOUR, force: payload.force },
    );

    if (!decision.send) {
      outcomes.push({ jobId: job.id, sent: false, reason: decision.reason });
      continue;
    }

    outcomes.push(await sendReminder(supabase, job, business, now, payload.dryRun === true));
  }

  const sent = outcomes.filter((outcome) => outcome.sent).length;
  const failed = outcomes.filter((outcome) => outcome.reason === 'send_failed').length;

  if (sent || failed) {
    console.log(
      `send-customer-job-reminders: ${sent} sent, ${failed} failed, ${outcomes.length} considered`,
    );
  }

  // A sweep over a quiet week is mostly skips, so it reports only the news. An
  // explicit jobId or dryRun call is a question about specific jobs and gets
  // every row back, skip reasons included.
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
