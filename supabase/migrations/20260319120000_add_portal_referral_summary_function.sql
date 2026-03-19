/*
  # Add portal referral summary lookup

  ## Summary
  1. Expose the logged-in customer's referral code and credit totals via a secure helper.
  2. Match the portal customer to the existing client record using the same organization and contact identity.
*/

CREATE OR REPLACE FUNCTION public.get_my_referral_summary()
RETURNS TABLE (
  referral_code text,
  referral_credit_balance numeric,
  referral_credit_used numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer public.customers%ROWTYPE;
BEGIN
  SELECT *
  INTO v_customer
  FROM public.customers
  WHERE id = public.current_customer_id();

  IF v_customer.id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    c.referral_code,
    COALESCE(c.referral_credit_balance, 0)::numeric,
    COALESCE(c.referral_credit_used, 0)::numeric
  FROM public.clients c
  WHERE c.organization_id = v_customer.organization_id
    AND (
      (
        v_customer.email IS NOT NULL
        AND btrim(v_customer.email) <> ''
        AND lower(c.email) = lower(v_customer.email)
      )
      OR (
        (v_customer.email IS NULL OR btrim(v_customer.email) = '')
        AND v_customer.phone IS NOT NULL
        AND btrim(v_customer.phone) <> ''
        AND regexp_replace(COALESCE(c.phone, ''), '\D', '', 'g') = regexp_replace(v_customer.phone, '\D', '', 'g')
      )
    )
  ORDER BY CASE WHEN c.referral_code IS NOT NULL THEN 0 ELSE 1 END, c.created_at ASC
  LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_referral_summary() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_referral_summary() TO authenticated;
