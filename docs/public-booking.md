# Public booking page

A shareable link — `https://boxed2built.com/book` — where a customer signs in
with Google and takes a real start time out of the owner's calendar. Everything
it offers is derived from four things: the weekly schedule set in the admin
portal, one-off date exceptions, jobs already scheduled, and bookings already
taken.

## The short version

| I want to… | Go to |
| --- | --- |
| Send someone the link | **Admin → Business Profile → Booking Availability**, copy the link at the top |
| Change which hours are bookable | Same page, **Weekly availability** |
| Take a day off | Same page, **Specific dates** |
| Accept or decline a request | **Admin → Core Operations → Bookings** |
| Turn booking off entirely | Same page, untick **Booking page is live** |

Booking ships **switched off**. Review the weekly hours first, then tick
*Booking page is live*.

## How a slot is decided

`get_available_booking_slots()` walks each date in range and keeps a start time
only when every one of these holds:

1. The date has a bookable window — a weekly rule for that weekday, or a date
   override that replaces it.
2. The date is not blocked by an override.
3. The start time is at least `min_lead_time_hours` away, and the date is within
   `max_advance_days`.
4. The day is under `max_bookings_per_day`.
5. The slot does not overlap a `pending` or `confirmed` booking, plus
   `buffer_minutes` either side.
6. The slot does not overlap a scheduled job, plus the same buffer.

Slot length is the chosen service's `duration_minutes` when
`use_service_duration` is on and the service has one; otherwise
`default_duration_minutes`. Start times step by `slot_interval_minutes` — 30
gives 9:00, 9:30, 10:00.

### What a scheduled job does

`jobs.date_scheduled` has always been a date with no time of day. This feature
adds `scheduled_start_time` and `scheduled_end_time`, editable in the Job form.

- **A job with a start time** blocks only its own hours plus the buffer.
- **A job with no start time** blocks the whole day. There is no way to tell
  when the owner will be busy, so the safe reading is "all of it".
- Setting `job_block_mode` to `whole_day` makes *every* scheduled job clear its
  date, regardless of times.
- Cancelled, lost and completed jobs never block.

A job created from a booking is not counted twice: the booking already holds the
slot, so day capacity only counts jobs with no `booking_id`.

## Approval

`require_approval` (on by default) decides what a submission becomes:

- **On** — the booking is `pending`. It holds its slot so nobody else can take
  it, and waits in **Admin → Bookings**. Confirming creates the scheduled job.
- **Off** — the booking is `confirmed` immediately and the job is created in the
  same transaction.

Declining or cancelling releases the slot and cancels the linked job.

## Staying in step with the Jobs page

Rescheduling a booking-derived job in the Jobs page moves the booking with it,
via the `trigger_sync_booking_from_job` trigger. Without that the booking would
still hold the old slot while the new one looked free — which is exactly how a
double booking happens. Cancelling or completing such a job does the same to its
booking.

## Where the link lives on the site

Booking is the second way in, not a replacement for the quote form. The quote
form asks for nothing and suits someone still working out what they need;
booking asks for a Google sign-in and suits someone who already knows. Making
both look equally primary would only split the ask, so:

| Placement | Treatment |
| --- | --- |
| Navbar | **Book Now** — the nav's only CTA button, which was an empty slot before |
| Homepage hero | A line under the buttons: "Already know what you need?" |
| Contact page | A card above the form, as the alternative to filling it in |
| Service pages | One line on the closing CTA band |
| Footer | Company column and the sitemap |
| FAQ | "What dates and times are you available?" answers with the URL |

Every one of these is hidden when `is_enabled` is off, so turning booking off
takes the links with it instead of leaving dead ends across the site.

### Telling a signed-out visitor anything at all

`/book` used to be a bare "Sign in to see open times" card. It asked for a Google
account before saying how far ahead you could book, that each request is
confirmed by hand, or — worst of all — whether booking was open at all: the
`is_enabled` check ran *after* the sign-in gate, so the reward for signing in
could be "we're closed".

`get_booking_public_info()` fixes both. It is the one booking function `anon` may
call, and it returns the policy only: the heading and intro, lead time, how far
ahead the calendar runs, the cancellation window, whether approval is required,
and which fields the form collects. No availability, no slots, no jobs, no
bookings, no `notify_email`, no ids — the same information you would print on a
flyer. The signed-out page is built from it, so the copy tracks the settings
instead of drifting from them, and the closed state now lands *before* the
sign-in.

`useBookingPublicInfo` holds the result at module scope the way
`businessDataStore` does. The header, footer and hero all ask on every page, and
between them that costs one request.

## Security

Signing in with Google is the whole gate — any Google account can book, which is
the point of a link you send to a customer.

- Every entry point is `authenticated`-only, with one deliberate exception.
  `anon` is revoked on all four tables and on every function except
  `get_booking_public_info()`, which returns the booking policy and nothing
  else so the signed-out page can describe itself (see above).
- `get_available_booking_slots()` and `get_booking_page_config()` are
  `SECURITY DEFINER`. They read `jobs` on the caller's behalf but return times
  and configuration only — never a job row, never another customer's booking.
- `create_booking()` re-derives the slot list server-side before inserting, so a
  hand-crafted request cannot book a Sunday, a blackout date, an hour that
  overlaps a job, or a time inside the notice period.
- The customer's email is read from their JWT, not the form body.
- `INSERT`, `UPDATE` and `DELETE` on `bookings` are revoked from
  `authenticated` outright. Every write goes through a validating function
  (`create_booking`, `confirm_booking`, `decline_booking`, `cancel_booking`),
  admins included.
- A customer may read and cancel their own bookings and nothing else.
- `max_active_bookings_per_customer` stops one account from holding the calendar.

### Concurrency

Two people clicking the same slot at the same moment are serialised by a
transaction-level advisory lock on the business and date, so the second one
re-runs the availability check and is told the time has gone. A partial unique
index on `(business_id, booking_date, start_time)` for active bookings backs
that up at the storage layer.

## Emails

`send-booking-email` handles three events. Sends are best-effort: a booking that
saved but failed to mail is still a booking, so the customer is never told
otherwise.

| Event | Who gets it |
| --- | --- |
| `created` | Owner gets the request; customer gets an acknowledgement |
| `confirmed` | Customer, with a timed `.ics` invite |
| `declined` | Customer, with the reason if one was given |

A `pending` booking carries no calendar invite — a decline would otherwise leave
a ghost event in the customer's calendar. The invite goes out on confirmation.

Unlike the job schedule mail, these are *timed* events, so the function converts
the local booking time to UTC using the configured IANA zone and writes the
`VEVENT` directly, reusing the shared line-folding and escaping helpers.

The owner's copy goes to `booking_settings.notify_email`, falling back to the
business contact address.

## Configuration

Everything lives on one `booking_settings` row per business, edited at
**Admin → Booking Availability**.

| Setting | Default | What it does |
| --- | --- | --- |
| `is_enabled` | `false` | Master switch for the page |
| `timezone` | `America/Chicago` | IANA zone every time is shown in |
| `default_duration_minutes` | `120` | Slot length when no service duration applies |
| `slot_interval_minutes` | `30` | Spacing between offered start times |
| `use_service_duration` | `true` | Let the picked service set the length |
| `buffer_minutes` | `30` | Travel/setup time kept clear either side |
| `min_lead_time_hours` | `24` | How much notice is required |
| `max_advance_days` | `60` | How far ahead the calendar goes |
| `max_bookings_per_day` | `2` | Day capacity, counting jobs too |
| `max_active_bookings_per_customer` | `3` | Per-account ceiling |
| `cancellation_cutoff_hours` | `24` | Customer self-cancel deadline |
| `block_on_scheduled_jobs` | `true` | Whether jobs eat availability |
| `job_block_mode` | `time_window` | `time_window` or `whole_day` |
| `require_approval` | `true` | Hold for approval vs. auto-confirm |
| `collect_*` | see page | Which fields the form asks for |

The weekly schedule is **separate from Business Hours**, which stay as the
published Google Business Profile listing. Narrowing your bookable hours should
not narrow your listing. The migration seeds the weekly schedule from the
current business hours as a starting point.

## Deploying

1. Apply `supabase/migrations/20260901120000_create_public_booking_system.sql`.
2. Deploy the edge function:
   `supabase functions deploy send-booking-email`.
3. Add `https://boxed2built.com/book` to the Supabase Auth redirect allowlist
   (Authentication → URL Configuration). Override it with
   `VITE_BOOKING_OAUTH_REDIRECT_URI` if the deployed origin differs.
4. In the admin portal, review **Booking Availability** and tick
   **Booking page is live**.

`/book` is excluded from static pre-rendering in `vite.config.ts` — it reads
live availability behind a sign-in, so a pre-rendered shell would only ever show
the signed-out state.
