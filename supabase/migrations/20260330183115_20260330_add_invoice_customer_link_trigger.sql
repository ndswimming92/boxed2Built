/*
  # Add trigger to auto-link invoice customer_id and client_id

  ## Summary
  When an invoice is inserted or its client_email is updated, automatically
  resolve and set customer_id and client_id by matching against the customers
  and clients tables. This ensures portal users can always see their invoices
  without relying solely on the app layer to set these fields.

  ## Changes
  1. Create function set_invoice_customer_and_client_ids() that resolves
     customer_id and client_id from client_email + organization_id.
  2. Attach that function as a BEFORE INSERT OR UPDATE trigger on invoices.

  ## Security
  - Function runs as SECURITY DEFINER so it can read customers/clients tables
    without being blocked by RLS.
  - Only runs the lookup when client_email is non-empty.
*/

CREATE OR REPLACE FUNCTION public.set_invoice_customer_and_client_ids()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NULLIF(BTRIM(NEW.client_email), '') IS NOT NULL AND NEW.organization_id IS NOT NULL THEN
    IF NEW.customer_id IS NULL THEN
      SELECT id INTO NEW.customer_id
      FROM public.customers
      WHERE organization_id = NEW.organization_id
        AND lower(email) = lower(NEW.client_email)
      ORDER BY created_at ASC
      LIMIT 1;
    END IF;

    IF NEW.client_id IS NULL THEN
      SELECT id INTO NEW.client_id
      FROM public.clients
      WHERE organization_id = NEW.organization_id
        AND lower(email) = lower(NEW.client_email)
      ORDER BY created_at ASC
      LIMIT 1;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_invoice_set_customer_and_client_ids ON public.invoices;

CREATE TRIGGER trg_invoice_set_customer_and_client_ids
  BEFORE INSERT OR UPDATE OF client_email, organization_id
  ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.set_invoice_customer_and_client_ids();
