/*
  # Restrict anonymous saved-request access to code-checked lookups

  1. Changes
     - Drop the anon SELECT policy on `saved_requests`, whose predicate was
       `is_active = true` and therefore exposed every request (including
       `confirmation_code`, email, phone and notes) to any anon-key caller.
     - Add `get_saved_request_by_code(text, text)`, which requires BOTH the
       email and the confirmation code and returns a single matching row.

  2. Security
     - SECURITY DEFINER with a pinned search_path, granted to anon and
       authenticated. Signed-in customers and org members keep their existing
       SELECT policy, which is unchanged.
*/

DROP POLICY IF EXISTS "Anonymous users can view saved requests by code" ON public.saved_requests;

CREATE OR REPLACE FUNCTION public.get_saved_request_by_code(
  p_email text,
  p_confirmation_code text
)
RETURNS SETOF public.saved_requests
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT sr.*
  FROM public.saved_requests sr
  WHERE p_email IS NOT NULL
    AND p_confirmation_code IS NOT NULL
    AND length(btrim(p_confirmation_code)) >= 4
    AND lower(btrim(sr.client_email)) = lower(btrim(p_email))
    AND upper(btrim(sr.confirmation_code)) = upper(btrim(p_confirmation_code))
    AND sr.is_active = true
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_saved_request_by_code(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_saved_request_by_code(text, text) TO anon, authenticated;
