/*
  # Public booking page

  A shareable link (`/book`) where a customer signed in with Google picks a real
  start time from the availability the owner configures in the admin portal.
  Slots are generated server-side from four inputs — a weekly schedule, one-off
  date overrides, jobs already on the calendar, and bookings already taken — so
  the browser never needs to see the job list to work out what is free.

  1. New tables
    - `booking_settings` — one row per business. The whole page is driven from
      here: on/off, timezone, slot length and step, buffer either side, how far
      ahead a customer may book, how much notice is required, the per-day cap,
      whether bookings wait for approval, and which fields the form collects.
    - `booking_availability_rules` — the weekly schedule, as windows keyed on
      `day_of_week` (0 = Sunday, matching `EXTRACT(DOW)`). A day may hold several
      windows, e.g. 09:00–12:00 and 13:00–17:00 to keep lunch clear.
    - `booking_date_overrides` — exceptions to that schedule for one date.
      `is_blocked` takes the day off entirely; a start/end pair instead replaces
      the weekly windows for that date, which is how a one-off Saturday opens up.
    - `bookings` — what the customer submitted, plus the slot it holds. A
      pending or confirmed booking blocks its window; declined and cancelled
      ones release it.

  2. New columns on `jobs`
     `scheduled_start_time` / `scheduled_end_time` give a scheduled job a time of
     day, which `date_scheduled` alone never carried. A job with a time blocks
     only its own window; a job without one blocks the whole day, because there
     is no way to tell when the owner will be busy. `booking_id` links a job back
     to the booking that produced it so the day's capacity is not counted twice.

  3. Public entry points (all SECURITY DEFINER, all `authenticated` only)
     `get_booking_page_config()` and `get_available_booking_slots()` expose
     availability without exposing a single job row, and `create_booking()`
     re-derives the slot list server-side before inserting, so a tampered
     payload cannot claim a time the page never offered. The customer's email
     comes from their JWT rather than the request body. `anon` is revoked
     throughout: signing in with Google is the gate on the whole feature.

  4. Security
     RLS on every new table: platform admins and organization admins manage
     everything; a customer may read and cancel their own bookings and nothing
     else. Direct INSERT on `bookings` is revoked from `authenticated` — the
     validating function is the only way in.
*/

-- ── Time helpers ─────────────────────────────────────────────────────────────
-- Slot maths runs on minutes-from-midnight rather than `time` values, because
-- `'23:00'::time + '2 hours'::interval` silently wraps to 01:00 and would hand
-- out slots that run past the end of the working day.

CREATE OR REPLACE FUNCTION public.booking_time_to_minutes(p_time time)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT (EXTRACT(HOUR FROM p_time)::int * 60) + EXTRACT(MINUTE FROM p_time)::int;
$$;

CREATE OR REPLACE FUNCTION public.booking_minutes_to_time(p_minutes integer)
RETURNS time
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_minutes IS NULL THEN NULL
    WHEN p_minutes <= 0 THEN '00:00:00'::time
    -- A window ending at midnight is the end of *this* day, not the start of the
    -- next, so it is clamped rather than allowed to roll over to 00:00.
    WHEN p_minutes >= 1440 THEN '23:59:59'::time
    ELSE make_time(p_minutes / 60, p_minutes % 60, 0)
  END;
$$;

COMMENT ON FUNCTION public.booking_time_to_minutes(time) IS 'Minutes from midnight, for wrap-free slot arithmetic.';
COMMENT ON FUNCTION public.booking_minutes_to_time(integer) IS 'Inverse of booking_time_to_minutes; clamps at end of day instead of wrapping.';

-- ── booking_settings ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.booking_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES business_info(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,

  is_enabled boolean NOT NULL DEFAULT false,
  timezone text NOT NULL DEFAULT 'America/Chicago',

  page_heading text NOT NULL DEFAULT 'Book your assembly',
  page_intro text NOT NULL DEFAULT 'Pick a day and a start time that works for you. You will get an email as soon as it is confirmed.',
  confirmation_message text NOT NULL DEFAULT 'Thanks! Your request is in. We will confirm by email shortly.',

  -- Slot shape
  default_duration_minutes integer NOT NULL DEFAULT 120,
  slot_interval_minutes integer NOT NULL DEFAULT 30,
  use_service_duration boolean NOT NULL DEFAULT true,
  buffer_minutes integer NOT NULL DEFAULT 30,

  -- Booking window
  min_lead_time_hours integer NOT NULL DEFAULT 24,
  max_advance_days integer NOT NULL DEFAULT 60,
  max_bookings_per_day integer NOT NULL DEFAULT 2,
  max_active_bookings_per_customer integer NOT NULL DEFAULT 3,
  cancellation_cutoff_hours integer NOT NULL DEFAULT 24,

  -- What already-scheduled jobs do to availability
  block_on_scheduled_jobs boolean NOT NULL DEFAULT true,
  job_block_mode text NOT NULL DEFAULT 'time_window',

  -- Approval
  require_approval boolean NOT NULL DEFAULT true,

  -- Form fields
  collect_service_type boolean NOT NULL DEFAULT true,
  collect_pieces boolean NOT NULL DEFAULT true,
  collect_photos boolean NOT NULL DEFAULT true,
  collect_phone text NOT NULL DEFAULT 'required',
  collect_address text NOT NULL DEFAULT 'optional',
  collect_notes boolean NOT NULL DEFAULT true,

  notify_email text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT booking_settings_business_unique UNIQUE (business_id),
  CONSTRAINT booking_settings_duration_check CHECK (default_duration_minutes BETWEEN 15 AND 1440),
  CONSTRAINT booking_settings_interval_check CHECK (slot_interval_minutes BETWEEN 5 AND 480),
  CONSTRAINT booking_settings_buffer_check CHECK (buffer_minutes BETWEEN 0 AND 480),
  CONSTRAINT booking_settings_lead_check CHECK (min_lead_time_hours BETWEEN 0 AND 8760),
  CONSTRAINT booking_settings_advance_check CHECK (max_advance_days BETWEEN 1 AND 365),
  CONSTRAINT booking_settings_per_day_check CHECK (max_bookings_per_day BETWEEN 1 AND 50),
  CONSTRAINT booking_settings_per_customer_check CHECK (max_active_bookings_per_customer BETWEEN 1 AND 50),
  CONSTRAINT booking_settings_cutoff_check CHECK (cancellation_cutoff_hours BETWEEN 0 AND 8760),
  CONSTRAINT booking_settings_job_block_mode_check CHECK (job_block_mode IN ('time_window', 'whole_day')),
  CONSTRAINT booking_settings_collect_phone_check CHECK (collect_phone IN ('off', 'optional', 'required')),
  CONSTRAINT booking_settings_collect_address_check CHECK (collect_address IN ('off', 'optional', 'required'))
);

COMMENT ON TABLE public.booking_settings IS 'Everything the public /book page is driven from. One row per business.';
COMMENT ON COLUMN public.booking_settings.job_block_mode IS 'time_window: a scheduled job blocks only its own hours. whole_day: any scheduled job clears the whole date.';
COMMENT ON COLUMN public.booking_settings.use_service_duration IS 'When true a service with duration_minutes sets the slot length; otherwise default_duration_minutes is always used.';
COMMENT ON COLUMN public.booking_settings.max_active_bookings_per_customer IS 'Ceiling on upcoming pending/confirmed bookings one signed-in customer may hold, so a single account cannot take the whole calendar.';

-- ── booking_availability_rules ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.booking_availability_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES business_info(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  day_of_week integer NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT booking_rules_dow_check CHECK (day_of_week BETWEEN 0 AND 6),
  CONSTRAINT booking_rules_order_check CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS idx_booking_rules_business_dow
  ON public.booking_availability_rules (business_id, day_of_week)
  WHERE is_active;

COMMENT ON TABLE public.booking_availability_rules IS 'Weekly bookable windows. day_of_week is 0=Sunday to match EXTRACT(DOW).';

-- ── booking_date_overrides ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.booking_date_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES business_info(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  override_date date NOT NULL,
  is_blocked boolean NOT NULL DEFAULT true,
  start_time time,
  end_time time,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Either the day is off, or it carries a replacement window. Never neither.
  CONSTRAINT booking_override_shape_check CHECK (
    (is_blocked AND start_time IS NULL AND end_time IS NULL)
    OR (NOT is_blocked AND start_time IS NOT NULL AND end_time IS NOT NULL AND end_time > start_time)
  )
);

CREATE INDEX IF NOT EXISTS idx_booking_overrides_business_date
  ON public.booking_date_overrides (business_id, override_date);

COMMENT ON TABLE public.booking_date_overrides IS 'Per-date exceptions: a day off, or replacement hours that supersede the weekly schedule for that date.';

-- ── bookings ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES business_info(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  reference text NOT NULL,

  -- Identity comes from the Google session, not the form.
  auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_email text NOT NULL,
  customer_name text NOT NULL,
  customer_phone text,
  service_address text,

  service_id uuid REFERENCES services(id) ON DELETE SET NULL,
  service_name text,
  pieces integer,
  notes text,
  photo_paths text[] NOT NULL DEFAULT '{}',

  booking_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  duration_minutes integer NOT NULL,
  timezone text NOT NULL DEFAULT 'America/Chicago',

  status text NOT NULL DEFAULT 'pending',
  job_id uuid REFERENCES jobs(id) ON DELETE SET NULL,

  confirmed_at timestamptz,
  declined_at timestamptz,
  cancelled_at timestamptz,
  cancelled_by text,
  cancellation_reason text,
  decision_note text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT bookings_reference_unique UNIQUE (reference),
  CONSTRAINT bookings_status_check CHECK (status IN ('pending', 'confirmed', 'declined', 'cancelled', 'completed')),
  CONSTRAINT bookings_duration_check CHECK (duration_minutes BETWEEN 15 AND 1440),
  CONSTRAINT bookings_pieces_check CHECK (pieces IS NULL OR pieces > 0),
  CONSTRAINT bookings_cancelled_by_check CHECK (cancelled_by IS NULL OR cancelled_by IN ('customer', 'admin'))
);

-- Two customers cannot hold the same start time. The transaction-level advisory
-- lock in create_booking() serialises the overlap check that this backstops.
CREATE UNIQUE INDEX IF NOT EXISTS bookings_active_slot_unique
  ON public.bookings (business_id, booking_date, start_time)
  WHERE status IN ('pending', 'confirmed');

CREATE INDEX IF NOT EXISTS idx_bookings_business_date
  ON public.bookings (business_id, booking_date)
  WHERE status IN ('pending', 'confirmed');

CREATE INDEX IF NOT EXISTS idx_bookings_status_created
  ON public.bookings (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bookings_auth_user
  ON public.bookings (auth_user_id, booking_date DESC)
  WHERE auth_user_id IS NOT NULL;

COMMENT ON TABLE public.bookings IS 'Customer-submitted bookings from the public /book page. Pending and confirmed rows hold their slot.';
COMMENT ON COLUMN public.bookings.photo_paths IS 'Storage paths in the furniture-photos bucket, same bucket the quote form uploads to.';

-- ── jobs: give a scheduled job a time of day ─────────────────────────────────
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS scheduled_start_time time;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS scheduled_end_time time;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL;

COMMENT ON COLUMN jobs.scheduled_start_time IS 'Local start time on date_scheduled. NULL means the whole day is treated as busy for booking availability.';
COMMENT ON COLUMN jobs.scheduled_end_time IS 'Local end time on date_scheduled. Ignored when scheduled_start_time is NULL.';
COMMENT ON COLUMN jobs.booking_id IS 'The public booking this job came from, if any. Keeps the day-capacity count from double-counting it.';

CREATE INDEX IF NOT EXISTS idx_jobs_booking_id
  ON jobs (booking_id)
  WHERE booking_id IS NOT NULL;

-- ── updated_at triggers ──────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS update_booking_settings_updated_at ON public.booking_settings;
CREATE TRIGGER update_booking_settings_updated_at
  BEFORE UPDATE ON public.booking_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_booking_rules_updated_at ON public.booking_availability_rules;
CREATE TRIGGER update_booking_rules_updated_at
  BEFORE UPDATE ON public.booking_availability_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_booking_overrides_updated_at ON public.booking_date_overrides;
CREATE TRIGGER update_booking_overrides_updated_at
  BEFORE UPDATE ON public.booking_date_overrides
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_bookings_updated_at ON public.bookings;
CREATE TRIGGER update_bookings_updated_at
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── Row level security ───────────────────────────────────────────────────────
ALTER TABLE public.booking_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_availability_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_date_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- Configuration is admin-only in both directions. The public page never selects
-- from these tables; it goes through get_booking_page_config() instead.
DROP POLICY IF EXISTS "Admins manage booking settings" ON public.booking_settings;
CREATE POLICY "Admins manage booking settings"
  ON public.booking_settings FOR ALL
  TO authenticated
  USING (is_platform_admin() OR has_org_permission(organization_id, 'admin'))
  WITH CHECK (is_platform_admin() OR has_org_permission(organization_id, 'admin'));

DROP POLICY IF EXISTS "Admins manage booking availability rules" ON public.booking_availability_rules;
CREATE POLICY "Admins manage booking availability rules"
  ON public.booking_availability_rules FOR ALL
  TO authenticated
  USING (is_platform_admin() OR has_org_permission(organization_id, 'admin'))
  WITH CHECK (is_platform_admin() OR has_org_permission(organization_id, 'admin'));

DROP POLICY IF EXISTS "Admins manage booking date overrides" ON public.booking_date_overrides;
CREATE POLICY "Admins manage booking date overrides"
  ON public.booking_date_overrides FOR ALL
  TO authenticated
  USING (is_platform_admin() OR has_org_permission(organization_id, 'admin'))
  WITH CHECK (is_platform_admin() OR has_org_permission(organization_id, 'admin'));

DROP POLICY IF EXISTS "Admins manage bookings" ON public.bookings;
CREATE POLICY "Admins manage bookings"
  ON public.bookings FOR ALL
  TO authenticated
  USING (is_platform_admin() OR has_org_permission(organization_id, 'admin'))
  WITH CHECK (is_platform_admin() OR has_org_permission(organization_id, 'admin'));

-- A signed-in customer sees the bookings they made and nothing else. There is
-- deliberately no INSERT or UPDATE policy for them: create_booking() and
-- cancel_my_booking() are the only writes, so every write is validated.
DROP POLICY IF EXISTS "Customers read own bookings" ON public.bookings;
CREATE POLICY "Customers read own bookings"
  ON public.bookings FOR SELECT
  TO authenticated
  USING (auth_user_id IS NOT NULL AND auth_user_id = auth.uid());

REVOKE ALL ON public.booking_settings FROM anon;
REVOKE ALL ON public.booking_availability_rules FROM anon;
REVOKE ALL ON public.booking_date_overrides FROM anon;
REVOKE ALL ON public.bookings FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.bookings FROM authenticated;

-- ── Availability engine ──────────────────────────────────────────────────────
/*
  Returns every start time a customer may still take, for one business, over a
  date range. Runs as SECURITY DEFINER so it can read `jobs` on behalf of a
  caller who has no rights to that table — it returns times only, never a job.

  A slot survives when all of these hold:
    * it sits inside a weekly window, or inside a date override replacing it
    * the date is not blocked, and is inside the lead time / advance window
    * the day is under its booking cap
    * it does not overlap a pending or confirmed booking, plus buffer
    * it does not overlap a scheduled job, plus buffer
*/
CREATE OR REPLACE FUNCTION public.get_available_booking_slots(
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL,
  p_duration_minutes integer DEFAULT NULL
)
RETURNS TABLE (
  slot_date date,
  start_time time,
  end_time time
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_settings public.booking_settings%ROWTYPE;
  v_today date;
  v_now_local timestamp;
  v_earliest timestamp;
  v_from date;
  v_to date;
  v_duration integer;
  v_date date;
  v_dow integer;
  v_window record;
  v_cursor integer;
  v_window_start integer;
  v_window_end integer;
  v_slot_end integer;
  v_day_blocked boolean;
  v_booked_today integer;
BEGIN
  SELECT s.* INTO v_settings
  FROM public.booking_settings s
  JOIN business_info b ON b.id = s.business_id
  WHERE b.is_active = true
  LIMIT 1;

  IF v_settings.id IS NULL OR NOT v_settings.is_enabled THEN
    RETURN;
  END IF;

  v_now_local := (now() AT TIME ZONE v_settings.timezone);
  v_today := v_now_local::date;
  v_earliest := v_now_local + make_interval(hours => v_settings.min_lead_time_hours);

  v_duration := GREATEST(COALESCE(p_duration_minutes, v_settings.default_duration_minutes), 15);

  v_from := GREATEST(COALESCE(p_from, v_today), v_today);
  v_to := LEAST(
    COALESCE(p_to, v_today + v_settings.max_advance_days),
    v_today + v_settings.max_advance_days
  );

  IF v_from > v_to THEN
    RETURN;
  END IF;

  FOR v_date IN SELECT d::date FROM generate_series(v_from, v_to, interval '1 day') AS d LOOP
    v_dow := EXTRACT(DOW FROM v_date)::int;

    -- A day taken off outright.
    IF EXISTS (
      SELECT 1 FROM public.booking_date_overrides o
      WHERE o.business_id = v_settings.business_id
        AND o.override_date = v_date
        AND o.is_blocked
    ) THEN
      CONTINUE;
    END IF;

    -- A job with no time of day tells us nothing about when the owner is free,
    -- so it takes the date out entirely. Same when the owner has chosen to have
    -- any scheduled job clear the day.
    v_day_blocked := false;
    IF v_settings.block_on_scheduled_jobs THEN
      SELECT EXISTS (
        SELECT 1 FROM jobs j
        WHERE j.business_id = v_settings.business_id
          AND j.date_scheduled = v_date
          AND j.is_active
          AND j.job_status NOT IN ('cancelled', 'lost', 'completed')
          AND (v_settings.job_block_mode = 'whole_day' OR j.scheduled_start_time IS NULL)
      ) INTO v_day_blocked;
    END IF;

    IF v_day_blocked THEN
      CONTINUE;
    END IF;

    -- Day capacity. Jobs created from a booking are already counted by that
    -- booking, so only unlinked jobs add to the total.
    SELECT
      (SELECT COUNT(*) FROM public.bookings bk
        WHERE bk.business_id = v_settings.business_id
          AND bk.booking_date = v_date
          AND bk.status IN ('pending', 'confirmed'))
      + (SELECT COUNT(*) FROM jobs j
        WHERE j.business_id = v_settings.business_id
          AND j.date_scheduled = v_date
          AND j.is_active
          AND j.booking_id IS NULL
          AND j.job_status NOT IN ('cancelled', 'lost', 'completed'))
    INTO v_booked_today;

    IF v_booked_today >= v_settings.max_bookings_per_day THEN
      CONTINUE;
    END IF;

    FOR v_window IN
      SELECT w.win_start, w.win_end FROM (
        -- A date override with hours replaces the weekly schedule for that date.
        SELECT o.start_time AS win_start, o.end_time AS win_end
        FROM public.booking_date_overrides o
        WHERE o.business_id = v_settings.business_id
          AND o.override_date = v_date
          AND NOT o.is_blocked
          AND o.start_time IS NOT NULL
        UNION ALL
        SELECT r.start_time, r.end_time
        FROM public.booking_availability_rules r
        WHERE r.business_id = v_settings.business_id
          AND r.day_of_week = v_dow
          AND r.is_active
          AND NOT EXISTS (
            SELECT 1 FROM public.booking_date_overrides o2
            WHERE o2.business_id = v_settings.business_id
              AND o2.override_date = v_date
              AND NOT o2.is_blocked
              AND o2.start_time IS NOT NULL
          )
      ) w
      ORDER BY w.win_start
    LOOP
      v_window_start := public.booking_time_to_minutes(v_window.win_start);
      v_window_end := public.booking_time_to_minutes(v_window.win_end);
      v_cursor := v_window_start;

      WHILE v_cursor + v_duration <= v_window_end LOOP
        v_slot_end := v_cursor + v_duration;

        IF (v_date + public.booking_minutes_to_time(v_cursor)) >= v_earliest
          AND NOT EXISTS (
            SELECT 1 FROM public.bookings bk
            WHERE bk.business_id = v_settings.business_id
              AND bk.booking_date = v_date
              AND bk.status IN ('pending', 'confirmed')
              AND public.booking_time_to_minutes(bk.start_time) - v_settings.buffer_minutes < v_slot_end
              AND public.booking_time_to_minutes(bk.end_time) + v_settings.buffer_minutes > v_cursor
          )
          AND NOT (
            v_settings.block_on_scheduled_jobs
            AND EXISTS (
              SELECT 1 FROM jobs j
              WHERE j.business_id = v_settings.business_id
                AND j.date_scheduled = v_date
                AND j.is_active
                AND j.booking_id IS NULL
                AND j.job_status NOT IN ('cancelled', 'lost', 'completed')
                AND j.scheduled_start_time IS NOT NULL
                AND public.booking_time_to_minutes(j.scheduled_start_time) - v_settings.buffer_minutes < v_slot_end
                AND public.booking_time_to_minutes(
                      COALESCE(j.scheduled_end_time, j.scheduled_start_time)
                    ) + v_settings.buffer_minutes > v_cursor
            )
          )
        THEN
          slot_date := v_date;
          start_time := public.booking_minutes_to_time(v_cursor);
          end_time := public.booking_minutes_to_time(v_slot_end);
          RETURN NEXT;
        END IF;

        v_cursor := v_cursor + v_settings.slot_interval_minutes;
      END LOOP;
    END LOOP;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.get_available_booking_slots(date, date, integer) IS 'Bookable start times over a date range. Reads jobs on the caller''s behalf but returns only times.';

REVOKE ALL ON FUNCTION public.get_available_booking_slots(date, date, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_available_booking_slots(date, date, integer) TO authenticated;

-- ── Page configuration ───────────────────────────────────────────────────────
/*
  Everything the /book page needs in one call: the copy, the shape of the slot
  picker, which fields to render, and the services a customer may pick from.
  Deliberately narrow — no job data, no other customer's booking, no internal
  notes — because any signed-in Google account can call it.
*/
CREATE OR REPLACE FUNCTION public.get_booking_page_config()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_settings public.booking_settings%ROWTYPE;
  v_business_name text;
  v_services jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to view booking availability' USING ERRCODE = '42501';
  END IF;

  SELECT s.* INTO v_settings
  FROM public.booking_settings s
  JOIN business_info b ON b.id = s.business_id
  WHERE b.is_active = true
  LIMIT 1;

  IF v_settings.id IS NULL THEN
    RETURN jsonb_build_object('is_enabled', false);
  END IF;

  SELECT b.name INTO v_business_name
  FROM business_info b
  WHERE b.id = v_settings.business_id;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', sv.id,
      'name', sv.name,
      'description', sv.description,
      'base_price', sv.base_price,
      'duration_minutes', sv.duration_minutes
    ) ORDER BY sv.display_order, sv.name
  ), '[]'::jsonb)
  INTO v_services
  FROM services sv
  WHERE sv.business_id = v_settings.business_id
    AND sv.is_active;

  RETURN jsonb_build_object(
    'is_enabled', v_settings.is_enabled,
    'business_name', v_business_name,
    'timezone', v_settings.timezone,
    'page_heading', v_settings.page_heading,
    'page_intro', v_settings.page_intro,
    'confirmation_message', v_settings.confirmation_message,
    'default_duration_minutes', v_settings.default_duration_minutes,
    'slot_interval_minutes', v_settings.slot_interval_minutes,
    'use_service_duration', v_settings.use_service_duration,
    'min_lead_time_hours', v_settings.min_lead_time_hours,
    'max_advance_days', v_settings.max_advance_days,
    'cancellation_cutoff_hours', v_settings.cancellation_cutoff_hours,
    'require_approval', v_settings.require_approval,
    'collect_service_type', v_settings.collect_service_type,
    'collect_pieces', v_settings.collect_pieces,
    'collect_photos', v_settings.collect_photos,
    'collect_phone', v_settings.collect_phone,
    'collect_address', v_settings.collect_address,
    'collect_notes', v_settings.collect_notes,
    'today', (now() AT TIME ZONE v_settings.timezone)::date,
    'services', v_services
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_booking_page_config() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_booking_page_config() TO authenticated;

-- ── Turning a booking into a job ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_job_from_booking(p_booking_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking public.bookings%ROWTYPE;
  v_job_id uuid;
BEGIN
  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id;

  IF v_booking.id IS NULL THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  IF v_booking.job_id IS NOT NULL THEN
    RETURN v_booking.job_id;
  END IF;

  INSERT INTO jobs (
    business_id,
    organization_id,
    customer_id,
    client_name,
    client_email,
    client_phone,
    service_address,
    job_type,
    job_description,
    date_quoted,
    date_scheduled,
    scheduled_start_time,
    scheduled_end_time,
    booking_id,
    job_status,
    notes,
    referral_source
  ) VALUES (
    v_booking.business_id,
    v_booking.organization_id,
    v_booking.customer_id,
    v_booking.customer_name,
    v_booking.customer_email,
    v_booking.customer_phone,
    v_booking.service_address,
    COALESCE(v_booking.service_name, 'Furniture Assembly'),
    NULLIF(
      CONCAT_WS(
        E'\n',
        CASE WHEN v_booking.pieces IS NOT NULL THEN 'Pieces: ' || v_booking.pieces END,
        v_booking.notes
      ),
      ''
    ),
    (v_booking.created_at AT TIME ZONE v_booking.timezone)::date,
    v_booking.booking_date,
    v_booking.start_time,
    v_booking.end_time,
    v_booking.id,
    'scheduled',
    'Booked online — reference ' || v_booking.reference,
    'booking_page'
  )
  RETURNING id INTO v_job_id;

  UPDATE public.bookings SET job_id = v_job_id WHERE id = p_booking_id;

  RETURN v_job_id;
END;
$$;

-- Internal only: reachable through confirm_booking() and create_booking().
REVOKE ALL ON FUNCTION public.create_job_from_booking(uuid) FROM PUBLIC, anon, authenticated;

-- ── Creating a booking ───────────────────────────────────────────────────────
/*
  The only write path from the public page. Re-derives availability rather than
  trusting the posted slot, so a hand-crafted request cannot book a Sunday, a
  blackout date, an hour that overlaps a job, or a time inside the notice
  period. Identity is taken from the JWT: the form cannot book as someone else.
*/
CREATE OR REPLACE FUNCTION public.create_booking(
  p_booking_date date,
  p_start_time time,
  p_customer_name text,
  p_service_id uuid DEFAULT NULL,
  p_pieces integer DEFAULT NULL,
  p_customer_phone text DEFAULT NULL,
  p_service_address text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_photo_paths text[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_settings public.booking_settings%ROWTYPE;
  v_user_id uuid := auth.uid();
  v_email text := NULLIF(LOWER(TRIM(auth.jwt() ->> 'email')), '');
  v_service_id uuid;
  v_service_name text;
  v_service_duration integer;
  v_duration integer;
  v_end_minutes integer;
  v_end_time time;
  v_active_count integer;
  v_reference text;
  v_booking public.bookings%ROWTYPE;
  v_status text;
  v_job_id uuid;
BEGIN
  IF v_user_id IS NULL OR v_email IS NULL THEN
    RAISE EXCEPTION 'Sign in with Google to book a time' USING ERRCODE = '42501';
  END IF;

  IF COALESCE(TRIM(p_customer_name), '') = '' THEN
    RAISE EXCEPTION 'Your name is required';
  END IF;

  SELECT s.* INTO v_settings
  FROM public.booking_settings s
  JOIN business_info b ON b.id = s.business_id
  WHERE b.is_active = true
  LIMIT 1;

  IF v_settings.id IS NULL OR NOT v_settings.is_enabled THEN
    RAISE EXCEPTION 'Online booking is not available right now';
  END IF;

  IF v_settings.collect_phone = 'required' AND COALESCE(TRIM(p_customer_phone), '') = '' THEN
    RAISE EXCEPTION 'A phone number is required';
  END IF;

  IF v_settings.collect_address = 'required' AND COALESCE(TRIM(p_service_address), '') = '' THEN
    RAISE EXCEPTION 'A service address is required';
  END IF;

  IF COALESCE(array_length(p_photo_paths, 1), 0) > 10 THEN
    RAISE EXCEPTION 'Too many photos on one booking';
  END IF;

  -- Slot length follows the chosen service when the owner has asked it to.
  v_duration := v_settings.default_duration_minutes;
  IF p_service_id IS NOT NULL THEN
    SELECT sv.id, sv.name, sv.duration_minutes
      INTO v_service_id, v_service_name, v_service_duration
    FROM services sv
    WHERE sv.id = p_service_id
      AND sv.business_id = v_settings.business_id
      AND sv.is_active;

    IF v_service_id IS NULL THEN
      RAISE EXCEPTION 'That service is not available';
    END IF;

    IF v_settings.use_service_duration AND COALESCE(v_service_duration, 0) >= 15 THEN
      v_duration := v_service_duration;
    END IF;
  END IF;

  -- One booking at a time per business/day, so two people cannot both pass the
  -- availability check for the same slot before either has inserted.
  PERFORM pg_advisory_xact_lock(hashtext(v_settings.business_id::text || ':' || p_booking_date::text));

  SELECT COUNT(*) INTO v_active_count
  FROM public.bookings bk
  WHERE bk.auth_user_id = v_user_id
    AND bk.status IN ('pending', 'confirmed')
    AND bk.booking_date >= (now() AT TIME ZONE v_settings.timezone)::date;

  IF v_active_count >= v_settings.max_active_bookings_per_customer THEN
    RAISE EXCEPTION 'You already have % upcoming booking(s). Cancel one before booking another.', v_active_count;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.get_available_booking_slots(p_booking_date, p_booking_date, v_duration) s
    WHERE s.slot_date = p_booking_date
      AND s.start_time = p_start_time
  ) THEN
    RAISE EXCEPTION 'That time is no longer available. Pick another slot.';
  END IF;

  v_end_minutes := public.booking_time_to_minutes(p_start_time) + v_duration;
  v_end_time := public.booking_minutes_to_time(v_end_minutes);

  v_reference := 'BK-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::text, '-', '') FROM 1 FOR 6));
  v_status := CASE WHEN v_settings.require_approval THEN 'pending' ELSE 'confirmed' END;

  INSERT INTO public.bookings (
    business_id,
    organization_id,
    reference,
    auth_user_id,
    customer_id,
    customer_email,
    customer_name,
    customer_phone,
    service_address,
    service_id,
    service_name,
    pieces,
    notes,
    photo_paths,
    booking_date,
    start_time,
    end_time,
    duration_minutes,
    timezone,
    status,
    confirmed_at
  ) VALUES (
    v_settings.business_id,
    v_settings.organization_id,
    v_reference,
    v_user_id,
    (SELECT c.id FROM public.customers c
      WHERE c.auth_user_id = v_user_id
         OR (c.organization_id = v_settings.organization_id AND LOWER(c.email) = v_email)
      ORDER BY (c.auth_user_id = v_user_id) DESC
      LIMIT 1),
    v_email,
    TRIM(p_customer_name),
    NULLIF(TRIM(COALESCE(p_customer_phone, '')), ''),
    NULLIF(TRIM(COALESCE(p_service_address, '')), ''),
    v_service_id,
    v_service_name,
    CASE WHEN v_settings.collect_pieces THEN p_pieces END,
    NULLIF(TRIM(COALESCE(p_notes, '')), ''),
    COALESCE(p_photo_paths, '{}'),
    p_booking_date,
    p_start_time,
    v_end_time,
    v_duration,
    v_settings.timezone,
    v_status,
    CASE WHEN v_status = 'confirmed' THEN now() END
  )
  RETURNING * INTO v_booking;

  IF v_status = 'confirmed' THEN
    v_job_id := public.create_job_from_booking(v_booking.id);
  END IF;

  RETURN jsonb_build_object(
    'id', v_booking.id,
    'reference', v_booking.reference,
    'status', v_status,
    'booking_date', v_booking.booking_date,
    'start_time', v_booking.start_time,
    'end_time', v_booking.end_time,
    'duration_minutes', v_booking.duration_minutes,
    'timezone', v_booking.timezone,
    'job_id', v_job_id,
    'confirmation_message', v_settings.confirmation_message
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_booking(date, time, text, uuid, integer, text, text, text, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_booking(date, time, text, uuid, integer, text, text, text, text[]) TO authenticated;

-- ── Admin decisions ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.confirm_booking(
  p_booking_id uuid,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking public.bookings%ROWTYPE;
  v_job_id uuid;
BEGIN
  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;

  IF v_booking.id IS NULL THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  IF NOT (is_platform_admin() OR has_org_permission(v_booking.organization_id, 'admin')) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;

  IF v_booking.status NOT IN ('pending', 'confirmed') THEN
    RAISE EXCEPTION 'A % booking cannot be confirmed', v_booking.status;
  END IF;

  v_job_id := public.create_job_from_booking(p_booking_id);

  UPDATE public.bookings
  SET status = 'confirmed',
      confirmed_at = COALESCE(confirmed_at, now()),
      decision_note = COALESCE(p_note, decision_note)
  WHERE id = p_booking_id;

  RETURN jsonb_build_object('id', p_booking_id, 'status', 'confirmed', 'job_id', v_job_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.decline_booking(
  p_booking_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking public.bookings%ROWTYPE;
BEGIN
  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;

  IF v_booking.id IS NULL THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  IF NOT (is_platform_admin() OR has_org_permission(v_booking.organization_id, 'admin')) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;

  IF v_booking.status IN ('declined', 'cancelled') THEN
    RETURN jsonb_build_object('id', p_booking_id, 'status', v_booking.status);
  END IF;

  -- Declining a booking that already produced a job cancels that job too,
  -- otherwise the slot stays busy for a booking nobody is honouring.
  IF v_booking.job_id IS NOT NULL THEN
    UPDATE jobs
    SET job_status = 'cancelled',
        is_active = false
    WHERE id = v_booking.job_id;
  END IF;

  UPDATE public.bookings
  SET status = 'declined',
      declined_at = now(),
      decision_note = p_reason
  WHERE id = p_booking_id;

  RETURN jsonb_build_object('id', p_booking_id, 'status', 'declined');
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_booking(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.decline_booking(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_booking(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decline_booking(uuid, text) TO authenticated;

-- ── Customer cancellation ────────────────────────────────────────────────────
/*
  A customer may release their own slot up to the cutoff. Admins may cancel at
  any point — they are the ones who have to make the visit work.
*/
CREATE OR REPLACE FUNCTION public.cancel_booking(
  p_booking_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking public.bookings%ROWTYPE;
  v_settings public.booking_settings%ROWTYPE;
  v_is_admin boolean;
  v_starts_at timestamp;
  v_actor text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to cancel a booking' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;

  IF v_booking.id IS NULL THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  v_is_admin := is_platform_admin() OR has_org_permission(v_booking.organization_id, 'admin');

  IF NOT v_is_admin AND v_booking.auth_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;

  IF v_booking.status IN ('cancelled', 'declined') THEN
    RETURN jsonb_build_object('id', p_booking_id, 'status', v_booking.status);
  END IF;

  IF v_booking.status = 'completed' THEN
    RAISE EXCEPTION 'A completed booking cannot be cancelled';
  END IF;

  IF NOT v_is_admin THEN
    SELECT * INTO v_settings FROM public.booking_settings WHERE business_id = v_booking.business_id;
    v_starts_at := v_booking.booking_date + v_booking.start_time;

    IF v_starts_at < (now() AT TIME ZONE v_booking.timezone)
       + make_interval(hours => COALESCE(v_settings.cancellation_cutoff_hours, 0)) THEN
      RAISE EXCEPTION 'This booking is too close to its start time to cancel online. Please call us.';
    END IF;
  END IF;

  IF v_booking.job_id IS NOT NULL THEN
    UPDATE jobs
    SET job_status = 'cancelled',
        is_active = false
    WHERE id = v_booking.job_id;
  END IF;

  v_actor := CASE WHEN v_is_admin THEN 'admin' ELSE 'customer' END;

  UPDATE public.bookings
  SET status = 'cancelled',
      cancelled_at = now(),
      cancelled_by = v_actor,
      cancellation_reason = p_reason
  WHERE id = p_booking_id;

  RETURN jsonb_build_object('id', p_booking_id, 'status', 'cancelled', 'cancelled_by', v_actor);
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_booking(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_booking(uuid, text) TO authenticated;

-- ── My bookings ──────────────────────────────────────────────────────────────
-- The RLS SELECT policy already scopes rows to the caller; this exists so the
-- page can list them without also being handed the column list of the table.
CREATE OR REPLACE FUNCTION public.get_my_bookings()
RETURNS TABLE (
  id uuid,
  reference text,
  booking_date date,
  start_time time,
  end_time time,
  timezone text,
  status text,
  service_name text,
  pieces integer,
  notes text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT b.id, b.reference, b.booking_date, b.start_time, b.end_time, b.timezone,
         b.status, b.service_name, b.pieces, b.notes, b.created_at
  FROM public.bookings b
  WHERE b.auth_user_id = auth.uid()
  ORDER BY b.booking_date DESC, b.start_time DESC;
$$;

REVOKE ALL ON FUNCTION public.get_my_bookings() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_bookings() TO authenticated;

-- ── Seed ─────────────────────────────────────────────────────────────────────
/*
  Give the active business a settings row and a starting weekly schedule taken
  from its published business hours, so the admin page opens on something
  recognisable rather than an empty grid. Booking stays switched off until the
  owner reviews the hours and enables it.
*/
DO $$
DECLARE
  v_business_id uuid;
  v_org_id uuid;
BEGIN
  SELECT id, organization_id INTO v_business_id, v_org_id
  FROM business_info
  WHERE is_active = true
  LIMIT 1;

  IF v_business_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.booking_settings (business_id, organization_id)
  VALUES (v_business_id, v_org_id)
  ON CONFLICT (business_id) DO NOTHING;

  IF NOT EXISTS (
    SELECT 1 FROM public.booking_availability_rules WHERE business_id = v_business_id
  ) THEN
    INSERT INTO public.booking_availability_rules (business_id, organization_id, day_of_week, start_time, end_time)
    SELECT
      v_business_id,
      v_org_id,
      CASE h.day_of_week
        WHEN 'Sunday' THEN 0
        WHEN 'Monday' THEN 1
        WHEN 'Tuesday' THEN 2
        WHEN 'Wednesday' THEN 3
        WHEN 'Thursday' THEN 4
        WHEN 'Friday' THEN 5
        WHEN 'Saturday' THEN 6
      END,
      h.opens,
      h.closes
    FROM business_hours h
    WHERE h.business_id = v_business_id
      AND NOT h.is_closed
      AND h.opens IS NOT NULL
      AND h.closes IS NOT NULL
      AND h.closes > h.opens;
  END IF;
END $$;

-- ── Keeping a booking and its job in step ────────────────────────────────────
/*
  Availability treats a booking-derived job as already accounted for by its
  booking, so the two must not drift. Moving such a job in the Jobs page — a
  different day, an earlier start — would otherwise leave the booking holding
  the old slot and the new one looking free, which is exactly how a double
  booking happens. Cancelling the job releases the booking for the same reason.
*/
CREATE OR REPLACE FUNCTION public.sync_booking_from_job()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start time;
  v_end time;
  v_duration integer;
BEGIN
  IF NEW.booking_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.job_status IN ('cancelled', 'lost') OR NOT NEW.is_active THEN
    UPDATE public.bookings
    SET status = 'cancelled',
        cancelled_at = COALESCE(cancelled_at, now()),
        cancelled_by = COALESCE(cancelled_by, 'admin'),
        cancellation_reason = COALESCE(cancellation_reason, 'Job ' || NEW.job_status)
    WHERE id = NEW.booking_id
      AND status IN ('pending', 'confirmed');
    RETURN NEW;
  END IF;

  IF NEW.job_status = 'completed' THEN
    UPDATE public.bookings
    SET status = 'completed'
    WHERE id = NEW.booking_id
      AND status IN ('pending', 'confirmed');
    RETURN NEW;
  END IF;

  IF NEW.date_scheduled IS NULL THEN
    RETURN NEW;
  END IF;

  -- Times are optional on a job; fall back to what the booking already holds so
  -- clearing them in the Jobs page never widens the slot to a zero-length one.
  SELECT
    COALESCE(NEW.scheduled_start_time, b.start_time),
    COALESCE(NEW.scheduled_end_time, NEW.scheduled_start_time + make_interval(mins => b.duration_minutes), b.end_time)
  INTO v_start, v_end
  FROM public.bookings b
  WHERE b.id = NEW.booking_id;

  IF v_start IS NULL OR v_end IS NULL THEN
    RETURN NEW;
  END IF;

  v_duration := GREATEST(
    public.booking_time_to_minutes(v_end) - public.booking_time_to_minutes(v_start),
    15
  );

  UPDATE public.bookings
  SET booking_date = NEW.date_scheduled,
      start_time = v_start,
      end_time = v_end,
      duration_minutes = v_duration
  WHERE id = NEW.booking_id
    AND (booking_date, start_time, end_time) IS DISTINCT FROM (NEW.date_scheduled, v_start, v_end);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_sync_booking_from_job ON jobs;
CREATE TRIGGER trigger_sync_booking_from_job
  AFTER UPDATE OF date_scheduled, scheduled_start_time, scheduled_end_time, job_status, is_active
  ON jobs
  FOR EACH ROW
  WHEN (NEW.booking_id IS NOT NULL)
  EXECUTE FUNCTION public.sync_booking_from_job();

COMMENT ON FUNCTION public.sync_booking_from_job() IS 'Mirrors reschedules and cancellations from a job back onto the booking that created it, so availability never sees two versions of the same slot.';

-- A trigger function has no business being reachable over /rest/v1/rpc. Calling
-- it directly would error rather than do damage, but leaving it granted is
-- needless surface, so it is internal like create_job_from_booking().
REVOKE ALL ON FUNCTION public.sync_booking_from_job() FROM PUBLIC, anon, authenticated;
