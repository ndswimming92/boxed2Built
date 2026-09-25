import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { authorizeAdminOrService } from '../_shared/authorize.ts';
import {
  decideReminder,
  type ReminderDecision,
  type ReminderJobFacts,
} from '../_shared/customerReminder.ts';
import {
  decideFollowup,
  type FollowupDecision,
  type FollowupJobFacts,
} from '../_shared/customerFollowup.ts';

/**
 * Every customer-facing email that is scheduled but not yet sent, merged
 * from the three places that each keep their own queue: day-before job
 * reminders and post-job follow-ups — both computed live from each job's
 * date and status, never stored as a row of their own — and the portal
 * welcome series, a real queue table (portal_welcome_email_queue).
 *
 * This is what powers the admin console's Scheduled Emails page. It sends
 * nothing and changes nothing: cancelling or resuming an email is a plain
 * write the browser makes directly (jobs.customer_reminder_cancelled_at /
 * follow_up_cancelled_at, or portal_welcome_email_queue.status), since
 * those columns already carry admin-only RLS and need no send logic behind
 * them. Reusing decideReminder/decideFollowup here, rather than
 * re-deriving "day before at 5pm" in the browser, is what keeps this list
 * honest — it can never show a time the function that actually sends the
 * email would disagree with.
 *
 * A job whose email has already gone out, or was never eligible in the
 * first place, is left out entirely — that history lives on the Email
 * Activity page. Only due / scheduled / cancelled / blocked rows are
 * returned, which is everything an admin can still act on.
 *
 * POST with no body (or {}).
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type, Authorization, X-Client-Info, Apikey, X-Correlation-Id, X-Session-Correlation-Id',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

/** Used when a business has no booking settings row to read a timezone from. */
const DEFAULT_TIMEZONE = 'America/Chicago';

/**
 * How far the job query looks on each side of today. A follow-up can still
 * be owed for a job that ended weeks ago, so the lookback is generous; the
 * lookahead just needs to cover how far out this business ever books.
 */
const LOOKBACK_DAYS = 30;
const LOOKAHEAD_DAYS = 180;

/** The union of every status either email cares about, so one query covers both. */
const JOB_STATUSES = ['scheduled', 'accepted', 'in_progress', 'completed'];

interface JobRow {
  id: string;
  business_id: string;
  client_name: string | null;
  client_email: string | null;
  job_type: string | null;
  job_description: string | null;
  job_status: string | null;
  is_active: boolean;
  date_scheduled: string | null;
  scheduled_start_time: string | null;
  scheduled_end_time: string | null;
  customer_reminder_for: string | null;
  customer_reminder_start_time: string | null;
  customer_reminder_cancelled_at: string | null;
  follow_up_for_date: string | null;
  follow_up_for_end_time: string | null;
  follow_up_cancelled_at: string | null;
}

const JOB_COLUMNS =
  'id, business_id, client_name, client_email, job_type, job_description, job_status, is_active, ' +
  'date_scheduled, scheduled_start_time, scheduled_end_time, customer_reminder_for, ' +
  'customer_reminder_start_time, customer_reminder_cancelled_at, follow_up_for_date, ' +
  'follow_up_for_end_time, follow_up_cancelled_at';

interface WelcomeRow {
  id: string;
  sequence_step: number;
  template_key: string;
  scheduled_for: string;
  status: string;
  customers: { email: string | null; full_name: string | null } | null;
}

/**
 * Mirrors the TEMPLATES map in send-portal-welcome-emails/index.ts. Kept as
 * a short label here rather than importing that function's subject copy,
 * since this list needs a step name, not the email itself.
 */
const WELCOME_LABELS: Record<string, string> = {
  portal_welcome_benefits: 'Portal welcome email (1 of 3)',
  portal_how_to_use_jobs_invoices_support: 'Portal welcome email (2 of 3)',
  portal_complete_profile_contact_preferences: 'Portal welcome email (3 of 3)',
};

type RowStatus = 'due' | 'scheduled' | 'cancelled' | 'blocked';

export interface ScheduledEmailRow {
  /** Stable across refetches, so the browser can key a table row on it. */
  id: string;
  kind: 'reminder' | 'followup' | 'welcome';
  label: string;
  /** Job type/description for a reminder or follow-up; null for a welcome step. */
  detail: string | null;
  recipientName: string | null;
  recipientEmail: string | null;
  /** ISO instant, in every case except a job with no date/end time to compute one from. */
  sendAt: string | null;
  status: RowStatus;
  reason: string | null;
  /** IANA zone the job's business runs on, so the browser renders sendAt correctly. */
  timeZone: string;
  jobId?: string;
  queueId?: string;
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

async function loadTimeZones(
  supabase: SupabaseClient,
  businessIds: string[],
): Promise<Map<string, string>> {
  const zones = new Map<string, string>();
  if (businessIds.length === 0) return zones;

  // Job times are bare local times; they only mean something against the
  // business timezone the booking page already configures.
  const { data } = await supabase
    .from('booking_settings')
    .select('business_id, timezone')
    .in('business_id', businessIds)
    .returns<{ business_id: string; timezone: string | null }[]>();

  for (const row of data ?? []) {
    zones.set(row.business_id, row.timezone?.trim() || DEFAULT_TIMEZONE);
  }
  return zones;
}

/**
 * Which rows are worth showing on this page. `null` means "already sent" or
 * "was never going to happen" — noise this list leaves out on purpose.
 */
function reminderRowStatus(decision: ReminderDecision): RowStatus | null {
  if (decision.send) return 'due';
  switch (decision.reason) {
    case 'too_early':
      return 'scheduled';
    case 'cancelled':
      return 'cancelled';
    case 'no_client_email':
      return 'blocked';
    default:
      return null;
  }
}

function followupRowStatus(decision: FollowupDecision): RowStatus | null {
  if (decision.send) return 'due';
  switch (decision.reason) {
    case 'too_early':
      return 'scheduled';
    case 'cancelled':
      return 'cancelled';
    case 'no_client_email':
      return 'blocked';
    default:
      return null;
  }
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

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const now = new Date();

  const { data: jobs, error: jobsError } = await supabase
    .from('jobs')
    .select(JOB_COLUMNS)
    .eq('is_active', true)
    .in('job_status', JOB_STATUSES)
    .gte('date_scheduled', utcDateOffset(now, -LOOKBACK_DAYS))
    .lte('date_scheduled', utcDateOffset(now, LOOKAHEAD_DAYS))
    .returns<JobRow[]>();

  if (jobsError) {
    console.error('list-scheduled-emails: job lookup failed', jobsError);
    return json({ success: false, error: 'Failed to load jobs' }, 500);
  }

  const timeZones = await loadTimeZones(
    supabase,
    Array.from(new Set((jobs ?? []).map((job) => job.business_id))),
  );

  const rows: ScheduledEmailRow[] = [];

  for (const job of jobs ?? []) {
    const timeZone = timeZones.get(job.business_id) ?? DEFAULT_TIMEZONE;
    const detail = job.job_type?.trim() || job.job_description?.trim() || null;
    const recipientEmail = job.client_email?.trim() || null;

    const reminderFacts: ReminderJobFacts = {
      dateScheduled: job.date_scheduled,
      scheduledStartTime: job.scheduled_start_time,
      clientEmail: job.client_email,
      isActive: job.is_active,
      jobStatus: job.job_status,
      reminderFor: job.customer_reminder_for,
      reminderStartTime: job.customer_reminder_start_time,
      reminderCancelledAt: job.customer_reminder_cancelled_at,
    };
    const reminderDecision = decideReminder(reminderFacts, { now, timeZone });
    const reminderStatus = reminderRowStatus(reminderDecision);
    if (reminderStatus) {
      rows.push({
        id: `reminder:${job.id}`,
        kind: 'reminder',
        label: 'Appointment reminder',
        detail,
        recipientName: job.client_name,
        recipientEmail,
        sendAt: reminderDecision.sendAt?.toISOString() ?? null,
        status: reminderStatus,
        reason: reminderDecision.send ? null : reminderDecision.reason,
        timeZone,
        jobId: job.id,
      });
    }

    const followupFacts: FollowupJobFacts = {
      dateScheduled: job.date_scheduled,
      scheduledEndTime: job.scheduled_end_time,
      clientEmail: job.client_email,
      isActive: job.is_active,
      jobStatus: job.job_status,
      followUpForDate: job.follow_up_for_date,
      followUpForEndTime: job.follow_up_for_end_time,
      followUpCancelledAt: job.follow_up_cancelled_at,
    };
    const followupDecision = decideFollowup(followupFacts, { now, timeZone });
    const followupStatus = followupRowStatus(followupDecision);
    if (followupStatus) {
      rows.push({
        id: `followup:${job.id}`,
        kind: 'followup',
        label: 'Post-job thank-you & review request',
        detail,
        recipientName: job.client_name,
        recipientEmail,
        sendAt: followupDecision.sendAt?.toISOString() ?? null,
        status: followupStatus,
        reason: followupDecision.send ? null : followupDecision.reason,
        timeZone,
        jobId: job.id,
      });
    }
  }

  const { data: welcomeRows, error: welcomeError } = await supabase
    .from('portal_welcome_email_queue')
    .select('id, sequence_step, template_key, scheduled_for, status, customers ( email, full_name )')
    .in('status', ['pending', 'cancelled'])
    .order('scheduled_for', { ascending: true })
    .limit(200)
    .returns<WelcomeRow[]>();

  if (welcomeError) {
    // Not fatal: the job-derived rows above are still useful on their own.
    console.error('list-scheduled-emails: welcome queue lookup failed', welcomeError);
  }

  for (const row of welcomeRows ?? []) {
    const status: RowStatus =
      row.status === 'cancelled' ? 'cancelled' : new Date(row.scheduled_for) <= now ? 'due' : 'scheduled';

    rows.push({
      id: `welcome:${row.id}`,
      kind: 'welcome',
      label: WELCOME_LABELS[row.template_key] ?? `Portal welcome email (step ${row.sequence_step})`,
      detail: null,
      recipientName: row.customers?.full_name ?? null,
      recipientEmail: row.customers?.email ?? null,
      sendAt: row.scheduled_for,
      status,
      reason: row.status === 'cancelled' ? 'cancelled' : null,
      timeZone: DEFAULT_TIMEZONE,
      queueId: row.id,
    });
  }

  // Soonest first; a row with no computable sendAt (shouldn't happen for
  // anything included above, but cheap to guard) sorts to the end.
  rows.sort((a, b) => {
    if (!a.sendAt && !b.sendAt) return 0;
    if (!a.sendAt) return 1;
    if (!b.sendAt) return -1;
    return a.sendAt.localeCompare(b.sendAt);
  });

  return json({ success: true, generatedAt: now.toISOString(), emails: rows });
});
