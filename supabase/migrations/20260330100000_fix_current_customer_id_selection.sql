/*
  # Choose the best linked customer record for portal-scoped RLS

  ## Why
  Some environments can end up with multiple `customers` rows linked to the
  same auth user. The previous `current_customer_id()` implementation selected
  the oldest row, which can be a profile-only record with no jobs/invoices.
  When that happens, portal pages appear empty even though historical records
  exist under another linked customer row.

  ## What
  Recreate `public.current_customer_id()` to pick the linked customer with the
  most associated jobs/invoices, then fall back to the most recently updated
  profile.
*/

CREATE OR REPLACE FUNCTION public.current_customer_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT candidate.id
  FROM (
    SELECT
      c.id,
      (
        SELECT COUNT(*)::bigint
        FROM public.jobs j
        WHERE j.customer_id = c.id
      ) + (
        SELECT COUNT(*)::bigint
        FROM public.invoices i
        WHERE i.customer_id = c.id
      ) AS portal_record_count,
      c.updated_at,
      c.created_at
    FROM public.customers c
    WHERE c.auth_user_id = auth.uid()
  ) AS candidate
  ORDER BY
    candidate.portal_record_count DESC,
    candidate.updated_at DESC,
    candidate.created_at DESC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.current_customer_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_customer_id() TO authenticated;
