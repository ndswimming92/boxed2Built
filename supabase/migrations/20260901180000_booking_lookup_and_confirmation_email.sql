/*
  # Booking lookup by reference, and a confirmation email that actually sends

  Two gaps from the public booking page:

  1. The `BK-` reference on a booking meant nothing to `/lookup-request`, which
     only searches `saved_requests`. A customer holding a booking code got
     "No request found". `lookup_booking_by_code()` fills that in, mirroring
     `get_saved_request_by_code()`: the email and the code must both match, it
     runs SECURITY DEFINER so an anonymous visitor never reads the table
     directly, and it returns only what that customer already submitted.

  2. The confirmation email was sent by the customer's browser calling the
     `send-booking-email` edge function, and every failure was swallowed. A real
     booking (BK-40FAE6) produced no mail at all, through both its `created` and
     its `confirmed` step, with nothing recorded anywhere to say why.

     Sending now happens here instead, from a trigger, over `net.http_post` —
     the same pg_net + Vault pattern the coupon reminder cron already uses. The
     browser is no longer involved, so closing the tab, a transient network
     failure, or an error in the invoke path cannot cost the customer their
     confirmation.
*/

-- ── Lookup ───────────────────────────────────────────────────────────────────
/*
  Deliberately narrow: no ids, no job link, no admin decision note. Everything
  returned is something this customer typed in or was told.
*/
CREATE OR REPLACE FUNCTION public.lookup_booking_by_code(
  p_email text,
  p_confirmation_code text
)
RETURNS TABLE (
  reference text,
  status text,
  customer_name text,
  customer_email text,
  customer_phone text,
  service_address text,
  service_name text,
  pieces integer,
  notes text,
  booking_date date,
  start_time time,
  end_time time,
  duration_minutes integer,
  timezone text,
  cancellation_reason text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.reference, b.status, b.customer_name, b.customer_email, b.customer_phone,
         b.service_address, b.service_name, b.pieces, b.notes,
         b.booking_date, b.start_time, b.end_time, b.duration_minutes, b.timezone,
         b.cancellation_reason, b.created_at
  FROM public.bookings b
  WHERE p_email IS NOT NULL
    AND p_confirmation_code IS NOT NULL
    AND length(btrim(p_confirmation_code)) >= 6
    AND lower(btrim(b.customer_email)) = lower(btrim(p_email))
    AND upper(btrim(b.reference)) = upper(btrim(p_confirmation_code))
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.lookup_booking_by_code(text, text) IS
  'Customer-facing booking lookup by email + BK- reference, mirroring get_saved_request_by_code.';

REVOKE ALL ON FUNCTION public.lookup_booking_by_code(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_booking_by_code(text, text) TO anon, authenticated;

-- ── Confirmation email ───────────────────────────────────────────────────────
/*
  Selecting FROM the vault view rather than sub-querying into the header means a
  missing secret sends nothing at all, instead of posting a NULL Authorization
  header and collecting 401s — the same reasoning as the coupon reminder cron.
  The secret is stored once, by hand:

      SELECT vault.create_secret('<service role key>', 'service_role_key');

  pg_net queues the request inside the transaction, so a booking that rolls back
  never sends mail for a row that does not exist.
*/
CREATE OR REPLACE FUNCTION public.send_booking_email_async(
  p_booking_id uuid,
  p_event text
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT net.http_post(
    url := 'https://nlqzjzxkqteihffptkah.supabase.co/functions/v1/send-booking-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || s.decrypted_secret
    ),
    body := jsonb_build_object('bookingId', p_booking_id, 'event', p_event)
  )
  FROM vault.decrypted_secrets s
  WHERE s.name = 'service_role_key';
$$;

REVOKE ALL ON FUNCTION public.send_booking_email_async(uuid, text) FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.send_booking_email_async(uuid, text) IS
  'Queues a booking notification to the send-booking-email edge function via pg_net. Internal; called only by trigger_booking_email.';

CREATE OR REPLACE FUNCTION public.trigger_booking_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Covers both settings: a pending booking gets "we are holding this", an
    -- auto-confirmed one gets the confirmation with its calendar invite.
    PERFORM public.send_booking_email_async(NEW.id, 'created');
    RETURN NEW;
  END IF;

  -- Only a real transition sends, so re-saving a confirmed booking, or an admin
  -- editing a note, never mails the customer a second time.
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'confirmed' THEN
      PERFORM public.send_booking_email_async(NEW.id, 'confirmed');
    ELSIF NEW.status = 'declined' THEN
      PERFORM public.send_booking_email_async(NEW.id, 'declined');
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_booking_email_on_insert ON public.bookings;
CREATE TRIGGER trigger_booking_email_on_insert
  AFTER INSERT ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_booking_email();

DROP TRIGGER IF EXISTS trigger_booking_email_on_status_change ON public.bookings;
CREATE TRIGGER trigger_booking_email_on_status_change
  AFTER UPDATE OF status ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_booking_email();

COMMENT ON FUNCTION public.trigger_booking_email() IS
  'Sends the booking confirmation from the database rather than the browser, so a closed tab or a failed client call cannot cost the customer their email.';

-- Trigger functions have no business on /rest/v1/rpc; calling one directly errors
-- rather than does damage, but the database advisor flags the exposure and it is
-- needless surface either way.
REVOKE ALL ON FUNCTION public.trigger_booking_email() FROM PUBLIC, anon, authenticated;
