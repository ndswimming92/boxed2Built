/*
# Lock down remaining unguarded privileged helper functions

1. Summary
- Four SECURITY DEFINER helpers could be called by any signed-in user (including customer
  portal users) with no authorization check.

2. Changes
- `get_total_expenses_by_period(uuid, integer, integer)` and `get_current_mileage_rate(uuid, date)`:
  not used by the app or by other database functions. EXECUTE revoked from PUBLIC, anon, authenticated.
- `generate_next_invoice_number(uuid)`: now requires the caller to be a platform admin or an
  org admin of the organization owning the invoice settings (same rule as the invoice_settings
  UPDATE policy). Unauthorized calls raise and roll back the counter change. Calls without a
  user session (service role / backend jobs) are unaffected.
- `update_client_metrics(uuid)`: now requires platform admin or org admin of the client's
  organization (same rule as the clients UPDATE policy), except when invoked from a trigger
  or without a user session, so the existing metric-refresh triggers keep working.

3. Notes
1. Function bodies are otherwise unchanged.
2. Safe to re-run: the update_client_metrics guard is only injected once.
*/

REVOKE EXECUTE ON FUNCTION public.get_total_expenses_by_period(uuid, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_current_mileage_rate(uuid, date) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.generate_next_invoice_number(p_business_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
v_prefix text;
v_next_number integer;
v_invoice_number text;
v_org_id uuid;
BEGIN
SELECT invoice_prefix, next_invoice_number
INTO v_prefix, v_next_number
FROM invoice_settings
WHERE business_id = p_business_id
FOR UPDATE;

IF NOT FOUND THEN
INSERT INTO invoice_settings (business_id, invoice_prefix, next_invoice_number)
VALUES (p_business_id, 'B2B', 2)
RETURNING invoice_prefix, 1
INTO v_prefix, v_next_number;
ELSE
UPDATE invoice_settings
SET next_invoice_number = next_invoice_number + 1,
updated_at = NOW()
WHERE business_id = p_business_id;
END IF;

SELECT organization_id INTO v_org_id
FROM invoice_settings
WHERE business_id = p_business_id
LIMIT 1;

-- Checked after the write so a rejected call's RAISE rolls the counter change back
IF auth.uid() IS NOT NULL AND NOT (public.is_platform_admin() OR public.can_manage_org_settings(v_org_id)) THEN
RAISE EXCEPTION 'Not authorized to generate invoice numbers' USING ERRCODE = '42501';
END IF;

v_invoice_number := v_prefix || '-' || LPAD(v_next_number::text, 3, '0');
RETURN v_invoice_number;
END;
$function$;

DO $$
DECLARE
v_def text;
BEGIN
v_def := pg_get_functiondef('public.update_client_metrics(uuid)'::regprocedure);
IF position('Not authorized to update client metrics' in v_def) = 0 THEN
v_def := regexp_replace(
v_def,
E'\nBEGIN\n',
E'\nBEGIN\nIF pg_trigger_depth() = 0 AND auth.uid() IS NOT NULL AND NOT (\npublic.is_platform_admin()\nOR EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_id_input AND public.can_manage_org_settings(c.organization_id))\n) THEN\nRAISE EXCEPTION ''Not authorized to update client metrics'' USING ERRCODE = ''42501'';\nEND IF;\n'
);
EXECUTE v_def;
END IF;
END $$;