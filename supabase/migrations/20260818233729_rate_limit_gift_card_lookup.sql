/*
  # Rate limit gift card code lookups

  1. Problem
     `public.lookup_gift_card_by_code` is SECURITY DEFINER and executable by
     `anon`. It confirmed any presented code and returned its remaining
     balance, with no throttling, making it an unmetered oracle for guessing
     live gift card codes.

  2. Changes
     - New table `gift_card_lookup_attempts` recording each attempt by request
       IP. RLS is enabled with no client policies: only the SECURITY DEFINER
       function below writes to it.
     - `lookup_gift_card_by_code` now records every attempt and refuses once a
       caller exceeds 10 attempts in a rolling 15 minute window. Its return
       shape is unchanged, so the gift card page keeps working.

  3. Security
     Legitimate customers checking their own balance are far below the cap.
*/

CREATE TABLE IF NOT EXISTS public.gift_card_lookup_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_ip text,
  attempted_at timestamptz NOT NULL DEFAULT now(),
  found boolean NOT NULL DEFAULT false
);

ALTER TABLE public.gift_card_lookup_attempts ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS gift_card_lookup_attempts_ip_time_idx
  ON public.gift_card_lookup_attempts (request_ip, attempted_at DESC);

REVOKE ALL ON TABLE public.gift_card_lookup_attempts FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.lookup_gift_card_by_code(p_code text)
RETURNS TABLE(
  code text,
  status text,
  initial_amount_cents integer,
  remaining_amount_cents integer,
  recipient_first_name text,
  delivery_type text,
  activated_at timestamp with time zone
)
LANGUAGE plpgsql
VOLATILE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_ip text;
  v_recent integer;
  v_found boolean := false;
BEGIN
  IF p_code IS NULL OR length(btrim(p_code)) < 6 THEN
    RETURN;
  END IF;

  v_ip := COALESCE(public.get_request_ip_from_headers(), 'unknown');

  SELECT count(*) INTO v_recent
  FROM public.gift_card_lookup_attempts a
  WHERE a.request_ip = v_ip
    AND a.attempted_at > now() - interval '15 minutes';

  IF v_recent >= 10 THEN
    RAISE EXCEPTION 'Too many gift card lookups. Please wait a few minutes and try again.'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.gift_cards gc
    WHERE upper(gc.code) = upper(btrim(p_code))
      AND gc.status IN ('active','partially_redeemed','redeemed','voided')
  ) INTO v_found;

  INSERT INTO public.gift_card_lookup_attempts (request_ip, found)
  VALUES (v_ip, v_found);

  -- Housekeeping: keep the throttle table small.
  DELETE FROM public.gift_card_lookup_attempts
  WHERE attempted_at < now() - interval '1 day';

  IF NOT v_found THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    gc.code,
    gc.status,
    gc.initial_amount_cents,
    gc.remaining_amount_cents,
    CASE
      WHEN gc.recipient_name IS NULL THEN NULL
      ELSE split_part(gc.recipient_name, ' ', 1)
    END AS recipient_first_name,
    gc.delivery_type,
    gc.activated_at
  FROM public.gift_cards gc
  WHERE upper(gc.code) = upper(btrim(p_code))
    AND gc.status IN ('active','partially_redeemed','redeemed','voided');
END;
$function$;

REVOKE ALL ON FUNCTION public.lookup_gift_card_by_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_gift_card_by_code(text) TO anon, authenticated;
