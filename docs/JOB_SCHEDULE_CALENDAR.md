# Job Schedule Calendar & Reminders

When a job gets a **Date Scheduled**, the admin who owns the schedule gets an
email carrying a calendar invite, plus a reminder in the admin notification bell.
There is also a subscribable calendar feed that mirrors the whole schedule.

## Why both an email and a feed

They fail in opposite directions, so running both covers the gap in each:

| | Emailed `.ics` attachment | Subscribed feed |
|---|---|---|
| Arrives | Instantly, per job | On the calendar app's poll (Apple ~1h, Google up to ~24h) |
| Reschedules | Sends a new invite that replaces the old event | Moves on its own |
| Cancellations | Stale event stays until you delete it | Disappears on its own |
| Effort | One tap per job | One-time setup, then nothing |

The email is the reliable "act on this now" signal. The feed is the always-correct
picture of the schedule. Neither needs Google OAuth.

## What's being built

`job_type` is a short, fixed category ("Furniture Assembly", "Table"). The actual
piece — "Farmhouse Queen Murphy Bed With Charging Station" — gets typed once as
an invoice's **labor** line item description, so the calendar entry (both the
per-job email's `.ics` and the subscribed feed) borrows it from there rather than
duplicating it onto the job as a second free-text field. `_shared/laborLineItems.ts`
loads every labor-type line item off the job's non-cancelled invoice(s) and adds
one `Labor: <description>` line per distinct item, oldest invoice first; a final
invoice that just restates the deposit's line item does not repeat it. A job with
no invoice yet, or none carrying a labor line, gets no `Labor:` line at all.

## How the email works

`supabase/functions/send-job-schedule-email` is called after a job saves
(`JobFormModal` → `jobScheduleCalendarService.sendJobScheduleEmail`). It:

1. Loads the job with the service role.
2. Skips silently when there is no `date_scheduled`, the job is inactive, or this
   exact date was already notified.
3. Builds an all-day `VEVENT` with two `VALARM` reminders.
4. Sends it through Resend as a `job.ics` attachment.
5. Records `schedule_notified_for` / `schedule_notified_at` / `schedule_ics_sequence`
   on the job, and inserts an `admin_notifications` row.

### No duplicates, ever

The event `UID` is derived from the job id (`job-<id>@boxed2built.com`) and never
changes. `SEQUENCE` rises on each send. Calendar apps use that pair to decide
whether an incoming invite *replaces* an event they already hold, so rescheduling
a job updates the existing calendar entry instead of adding a second one.

The `schedule_notified_for` column is what makes the call safe to fire on every
save: editing a price on an already-scheduled job sends nothing, because the
scheduled date still matches the one last notified. Only a genuinely new or
changed date sends mail.

### Clearing a scheduled date

Removing a job's date resets `schedule_notified_for`, so scheduling it again
later — even back to the same date — sends a fresh invite rather than being
swallowed by the guard above.

It does **not** retract an invite already filed in your calendar; that event
stays until you delete it. The subscribed feed does drop the job automatically,
which is the other reason to run both. Emitting a `METHOD:CANCEL` invite on
unschedule is a natural follow-up — `buildIcsCalendar` already supports it — but
is deliberately not wired up, since it would mean sending mail every time a date
is cleared.

Sending is **fire-and-forget** from the modal. The job row is already committed,
so a mail hiccup is logged to the console rather than shown as a save failure.
Because the send is idempotent per date, retrying later is safe.

## The subscribable feed

`supabase/functions/job-calendar-feed` serves `text/calendar` for every active,
non-cancelled job scheduled from 180 days back to 365 days ahead.

Calendar apps fetch a feed URL **without an Authorization header**, so this
function must be deployed with `verify_jwt` disabled, and the opaque token in the
query string is the only credential:

```
https://<project>.supabase.co/functions/v1/job-calendar-feed?token=<token>
```

Admin → Jobs → **Calendar** opens the subscription panel: it creates the token on
first open, offers copy-link and "Add to calendar app" (the `webcal://` form),
and carries a rotate control.

Programmatically, via `jobScheduleCalendarService`:

```ts
const feed = await getOrCreateCalendarFeedToken(organizationId);
const subscribeUrl = buildCalendarSubscribeUrl(feed.token); // webcal://…
```

- **Apple Calendar / iPhone**: File → New Calendar Subscription, paste the URL,
  set Auto-refresh to Every hour.
- **Google Calendar**: Other calendars → From URL, paste the `https://` form.
  Google controls its own refresh cadence and can lag up to a day — this is why
  the per-job email exists.

Anyone holding the URL can read the schedule, so treat it like a password.
`rotateCalendarFeedToken(organizationId)` revokes the current token and issues a
new one; existing subscribers stop updating and need the new URL.

## Reminder timing

Jobs are scheduled by date, not time, so events are all-day and alarms are
relative to local midnight:

| Env var | Default | Fires |
|---|---|---|
| `JOB_SCHEDULE_ALARM_DAY_BEFORE` | `-PT15H` | 9:00am the day before |
| `JOB_SCHEDULE_ALARM_DAY_OF` | `PT7H` | 7:00am on the day |

Both take any RFC 5545 duration. Negative is before the event, positive is after.

## Configuration

| Env var | Required | Purpose |
|---|---|---|
| `RESEND_API_KEY` | yes | Sending. Without it the function returns 500. |
| `JOB_SCHEDULE_NOTIFY_EMAIL` | no | Overrides the recipient. Defaults to `business_info.email`. |
| `SITE_URL` | no | Base for admin deep links. Defaults to `https://boxed2built.com`. |
| `JOB_SCHEDULE_ALARM_DAY_BEFORE` / `_DAY_OF` | no | Reminder offsets, above. |

## Deploying

```bash
supabase db push
supabase functions deploy send-job-schedule-email                 # verify_jwt on (default)
supabase functions deploy job-calendar-feed --no-verify-jwt      # public, token-gated
```

`send-job-schedule-email` authorizes through `_shared/authorize.ts`, so it accepts
a platform-admin JWT or the service role key and nothing else.

## Re-sending by hand

```ts
await sendJobScheduleEmail(jobId, true); // force past the already-notified guard
```

## Schema

`supabase/migrations/20260821120000_add_job_schedule_calendar_notifications.sql`

- `jobs.schedule_notified_for` (date) — date the last invite covered; null = never sent.
- `jobs.schedule_notified_at` (timestamptz) — when it went out.
- `jobs.schedule_ics_sequence` (int) — ICS `SEQUENCE`; must only ever increase.
- `calendar_feed_tokens` — revocable feed tokens, RLS-scoped to org members.

`supabase/migrations/20260821130000_backfill_job_schedule_notified.sql`

Marks jobs scheduled before this feature existed as already-notified, so editing
one does not fire an invite for work that already happened. Jobs dated today or
later are left alone and still get their first invite. The cutoff is evaluated
at migration time.
