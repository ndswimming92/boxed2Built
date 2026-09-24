import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  addDays,
  buildIcsCalendar,
  icsLeadTrigger,
  resolveTimedRange,
  type IcsEvent,
} from '../_shared/ics.ts';
import { formatLeaveByLabel, formatScheduleWhen } from '../_shared/scheduleLabels.ts';
import {
  computeLeaveBy,
  loadCachedTravelSeconds,
  loadTravelOrigin,
  normalizeAddress,
  resolveWorkAddress,
  type LeaveBy,
} from '../_shared/travel.ts';
import { loadLaborDescriptionsByJob } from '../_shared/laborLineItems.ts';

/**
 * Subscribable iCalendar feed of scheduled jobs.
 *
 * Google and Apple Calendar fetch a feed URL with no Authorization header, so
 * this endpoint is deliberately unauthenticated and gated on an opaque token in
 * the query string instead. Deploy it with verify_jwt disabled.
 *
 * Unlike the per-job email, the feed is the source of truth for the whole
 * schedule: a job that is rescheduled moves, and one that is cancelled or
 * deleted simply stops being emitted, so subscribers self-heal.
 */

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SITE_URL = Deno.env.get('SITE_URL') ?? 'https://boxed2built.com';
const ADMIN_JOBS_URL = `${SITE_URL}/admin/jobs`;

/*
 * All-day events start at local midnight, so -PT15H lands at 9:00am the day
 * before and PT7H at 7:00am on the day itself. A timed event starts when the
 * job does, so the same offsets would fire in the evening and — for PT7H — after
 * the job was already over; timed jobs get their own pair, both before DTSTART.
 */
const ALARM_DAY_BEFORE = Deno.env.get('JOB_SCHEDULE_ALARM_DAY_BEFORE') ?? '-PT15H';
const ALARM_DAY_OF = Deno.env.get('JOB_SCHEDULE_ALARM_DAY_OF') ?? 'PT7H';
const TIMED_ALARM_DAY_BEFORE = Deno.env.get('JOB_SCHEDULE_TIMED_ALARM_DAY_BEFORE') ?? '-P1D';
const TIMED_ALARM_LEAD = Deno.env.get('JOB_SCHEDULE_TIMED_ALARM_LEAD') ?? '-PT2H';

/** Used when the org has no booking settings row to read a timezone from. */
const DEFAULT_TIMEZONE = 'America/Chicago';

/** Keep the feed small enough to stay fast; a year ahead covers any real booking. */
const DAYS_BACK = 180;
const DAYS_AHEAD = 365;

/** Jobs in these states are no longer going to happen and are dropped from the feed. */
const EXCLUDED_STATUSES = ['lost', 'cancelled'];

/*
 * job_status is nullable (it carries a DEFAULT, not a NOT NULL), and in SQL
 * `NOT (NULL IN (...))` is NULL rather than true — a bare .not(...'in'...) would
 * drop every null-status job from the feed. Spell out the null case instead.
 */
const STATUS_FILTER = `job_status.is.null,job_status.not.in.(${EXCLUDED_STATUSES.join(',')})`;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

interface FeedJobRow {
  id: string;
  client_name: string;
  client_phone: string | null;
  client_email: string | null;
  client_address: string | null;
  service_address: string | null;
  job_type: string | null;
  job_description: string | null;
  date_scheduled: string;
  scheduled_start_time: string | null;
  scheduled_end_time: string | null;
  location_city: string | null;
  notes: string | null;
  job_status: string | null;
  schedule_ics_sequence: number | null;
}

function resolveLocation(job: FeedJobRow): string {
  const address = job.service_address?.trim() || job.client_address?.trim();
  if (address) return address.replace(/\s*\n\s*/g, ', ');
  return job.location_city?.trim() || '';
}

function buildDescription(
  job: FeedJobRow,
  location: string,
  leaveBy: LeaveBy | null,
  laborDescriptions: string[],
): string {
  const parts: string[] = [
    `When: ${formatScheduleWhen(job.date_scheduled, job.scheduled_start_time, job.scheduled_end_time)}`,
  ];
  // Directly under the start time, because it is the line that decides what the
  // morning looks like — the job's own hour is no use without it.
  if (leaveBy) parts.push(`Leave by: ${formatLeaveByLabel(leaveBy)}`);
  parts.push(`Client: ${job.client_name}`);
  if (job.client_phone) parts.push(`Phone: ${job.client_phone}`);
  if (job.client_email) parts.push(`Email: ${job.client_email}`);
  if (location) parts.push(`Where: ${location}`);
  if (job.job_status) parts.push(`Status: ${job.job_status.replace(/_/g, ' ')}`);
  for (const description of laborDescriptions) parts.push(`Labor: ${description}`);
  if (job.job_description) parts.push('', job.job_description.trim());
  if (job.notes) parts.push('', `Notes: ${job.notes.trim()}`);
  parts.push('', `Open in admin: ${ADMIN_JOBS_URL}`);
  return parts.join('\n');
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  const token = new URL(req.url).searchParams.get('token')?.trim();
  if (!token) {
    return new Response('Not found', { status: 404, headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: feedToken, error: tokenError } = await supabase
    .from('calendar_feed_tokens')
    .select('id, organization_id, label, is_active')
    .eq('token', token)
    .maybeSingle<{ id: string; organization_id: string; label: string | null; is_active: boolean }>();

  // A revoked or unknown token gets the same answer, so the endpoint cannot be
  // used to tell a real-but-disabled token from a guess.
  if (tokenError || !feedToken || !feedToken.is_active) {
    return new Response('Not found', { status: 404, headers: corsHeaders });
  }

  // Job times are stored as bare local times, so they only mean something against
  // the business timezone the booking page already configures.
  const { data: bookingSettings } = await supabase
    .from('booking_settings')
    .select('timezone')
    .eq('organization_id', feedToken.organization_id)
    .maybeSingle<{ timezone: string | null }>();

  const timeZone = bookingSettings?.timezone?.trim() || DEFAULT_TIMEZONE;

  const today = new Date().toISOString().slice(0, 10);

  const { data: jobs, error: jobsError } = await supabase
    .from('jobs')
    .select(
      'id, client_name, client_phone, client_email, client_address, service_address, job_type, ' +
        'job_description, date_scheduled, scheduled_start_time, scheduled_end_time, location_city, ' +
        'notes, job_status, schedule_ics_sequence',
    )
    .eq('organization_id', feedToken.organization_id)
    .eq('is_active', true)
    .not('date_scheduled', 'is', null)
    .gte('date_scheduled', addDays(today, -DAYS_BACK))
    .lte('date_scheduled', addDays(today, DAYS_AHEAD))
    .or(STATUS_FILTER)
    .order('date_scheduled', { ascending: true })
    .returns<FeedJobRow[]>();

  if (jobsError) {
    console.error('job-calendar-feed: job query failed', jobsError);
    return new Response('Unable to build feed', { status: 500, headers: corsHeaders });
  }

  // Read once for the whole feed, not once per job: this endpoint is polled
  // hourly by every subscribed calendar. Cache-only for the same reason — a
  // Mapbox call per job per poll per subscriber would be the wrong trade for a
  // line of text, so a job whose drive time was never looked up simply ships
  // without a leave-by until something warms the cache (the schedule email does,
  // as does opening the job's card in admin).
  const travelOrigin = await loadTravelOrigin(supabase, feedToken.organization_id);
  const driveSeconds = await loadCachedTravelSeconds(
    supabase,
    feedToken.organization_id,
    travelOrigin.address,
  );
  const laborDescriptionsByJob = await loadLaborDescriptionsByJob(
    supabase,
    (jobs ?? []).map((job) => job.id),
  );

  const events: IcsEvent[] = (jobs ?? []).map((job) => {
    const location = resolveLocation(job);
    const jobType = job.job_type?.trim() || 'Job';

    // The cache is keyed on the raw address, not the comma-joined display form
    // resolveLocation() builds, so the lookup has to start from the same value
    // the estimate was stored under.
    const destinationKey = normalizeAddress(resolveWorkAddress(job));
    const leaveBy = destinationKey
      ? computeLeaveBy(
          job.scheduled_start_time,
          driveSeconds.get(destinationKey) ?? null,
          travelOrigin.bufferMinutes,
        )
      : null;

    const event: IcsEvent = {
      // Same UID scheme as the emailed invite: it is the same logical event, and
      // a client that files both into one calendar can then collapse them.
      uid: `job-${job.id}@boxed2built.com`,
      sequence: job.schedule_ics_sequence ?? 0,
      startDate: job.date_scheduled,
      // With no start time the job stays an all-day block, which is also how the
      // booking page reads it: the whole day is busy.
      startTime: job.scheduled_start_time,
      endTime: job.scheduled_end_time,
      timeZone,
      summary: `${jobType} — ${job.client_name}`,
      description: buildDescription(job, location, leaveBy, laborDescriptionsByJob.get(job.id) ?? []),
      location: location || undefined,
      url: ADMIN_JOBS_URL,
    };

    // Ask the writer whether the times actually produced a timed event rather
    // than assuming, so the alarms can never disagree with DTSTART.
    const isTimed = resolveTimedRange(event) !== null;
    event.alarms = [
      {
        trigger: isTimed ? TIMED_ALARM_DAY_BEFORE : ALARM_DAY_BEFORE,
        description: `Tomorrow: ${jobType} for ${job.client_name}`,
      },
      {
        trigger: isTimed ? TIMED_ALARM_LEAD : ALARM_DAY_OF,
        description: `Today: ${jobType} for ${job.client_name}`,
      },
    ];

    // The alarm that does the actual work: it fires at the moment to walk out
    // the door, so the drive never has to be worked out by hand. Only on a timed
    // event — on an all-day one DTSTART is local midnight and a lead time
    // measured back from it means nothing. Emitted last so it sorts after the
    // heads-up reminders in clients that show them in file order.
    if (isTimed && leaveBy) {
      event.alarms.push({
        trigger: icsLeadTrigger(leaveBy.leadMinutes),
        description:
          `Leave now for ${jobType} — ${job.client_name}` +
          (location ? ` (${location})` : ''),
      });
    }

    return event;
  });

  const ics = buildIcsCalendar(events, {
    method: 'PUBLISH',
    name: feedToken.label?.trim() || 'Boxed2Built Jobs',
  });

  // Best-effort: a failure here must not cost the subscriber their feed.
  supabase
    .from('calendar_feed_tokens')
    .update({ last_accessed_at: new Date().toISOString() })
    .eq('id', feedToken.id)
    .then(({ error }) => {
      if (error) console.error('job-calendar-feed: failed to record access', error);
    });

  return new Response(req.method === 'HEAD' ? null : ics, {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="boxed2built-jobs.ics"',
      'Cache-Control': 'public, max-age=900',
    },
  });
});
