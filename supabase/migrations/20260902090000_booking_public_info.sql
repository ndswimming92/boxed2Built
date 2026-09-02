-- Public, sign-in-free view of the booking policy.
--
-- Everything else in the booking system is authenticated-only, which is right:
-- availability, jobs and bookings are nobody's business until you have signed
-- in. But that left two problems on the way in.
--
-- The first is that /book asked for a Google sign-in before it could say
-- whether booking was even open. Someone handing over an account to reach a
-- closed page is a bad trade, and it is a trade we were making every time the
-- switch was off.
--
-- The second is that the page could not describe itself. "How far ahead can I
-- book", "will this be confirmed straight away", "how late can I cancel" are
-- exactly the questions worth answering *before* the sign-in wall, and the
-- honest answers live in booking_settings.
--
-- So this returns the policy and nothing else: no availability, no slots, no
-- jobs, no bookings, no customer, no notify_email, no ids. It is the same
-- information the owner would print on a flyer, which is why anon may read it.
CREATE OR REPLACE FUNCTION public.get_booking_public_info()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT jsonb_build_object(
        'is_enabled',                s.is_enabled,
        'page_heading',              s.page_heading,
        'page_intro',                s.page_intro,
        'timezone',                  s.timezone,
        'min_lead_time_hours',       s.min_lead_time_hours,
        'max_advance_days',          s.max_advance_days,
        'cancellation_cutoff_hours', s.cancellation_cutoff_hours,
        'require_approval',          s.require_approval,
        -- What the form will ask for, so "what to have ready" can list the
        -- fields that actually exist rather than a guess that drifts.
        'collect_service_type',      s.collect_service_type,
        'collect_pieces',            s.collect_pieces,
        'collect_photos',            s.collect_photos,
        'collect_phone',             s.collect_phone,
        'collect_address',           s.collect_address
      )
      FROM public.booking_settings s
      JOIN public.business_info b ON b.id = s.business_id
      WHERE b.is_active = true
      LIMIT 1
    ),
    -- No settings row is the same answer as switched off: do not offer booking.
    jsonb_build_object('is_enabled', false)
  );
$$;

COMMENT ON FUNCTION public.get_booking_public_info() IS
  'Marketing-safe booking policy for signed-out visitors. Returns no availability, no bookings and no customer data.';

REVOKE ALL ON FUNCTION public.get_booking_public_info() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_booking_public_info() TO anon, authenticated;
