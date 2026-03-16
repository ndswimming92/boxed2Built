/*
  # Auto-link jobs and invoices to customers for portal visibility

  ## Why
  Jobs and invoices created after customer ownership rollout can still be saved
  without `customer_id`, which makes them invisible in customer-portal queries
  that are scoped by customer ownership.

  ## What
  1) Add helper to resolve customer from organization + email context.
  2) Add INSERT/UPDATE triggers for jobs/invoices to auto-populate customer_id.
  3) Backfill any existing jobs/invoices still missing customer_id.
*/

CREATE OR REPLACE FUNCTION public.resolve_customer_id_from_context(
  p_organization_id uuid,
  p_business_id uuid,
  p_client_id uuid,
  p_client_email text
)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_organization_id uuid;
  v_email text;
  v_customer_id uuid;
BEGIN
  v_organization_id := p_organization_id;

  IF v_organization_id IS NULL AND p_business_id IS NOT NULL THEN
    SELECT bi.organization_id
    INTO v_organization_id
    FROM public.business_info bi
    WHERE bi.id = p_business_id;
  END IF;

  v_email := NULLIF(BTRIM(p_client_email), '');

  IF v_email IS NULL AND p_client_id IS NOT NULL THEN
    SELECT NULLIF(BTRIM(cl.email), ''), COALESCE(v_organization_id, cl.organization_id)
    INTO v_email, v_organization_id
    FROM public.clients cl
    WHERE cl.id = p_client_id;
  END IF;

  IF v_organization_id IS NULL OR v_email IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT c.id
  INTO v_customer_id
  FROM public.customers c
  WHERE c.organization_id = v_organization_id
    AND LOWER(c.email) = LOWER(v_email)
  LIMIT 1;

  RETURN v_customer_id;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_customer_id_from_context(uuid, uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_customer_id_from_context(uuid, uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_customer_id_from_context(uuid, uuid, uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.auto_assign_job_customer_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.customer_id IS NULL THEN
    NEW.customer_id := public.resolve_customer_id_from_context(
      NEW.organization_id,
      NEW.business_id,
      NEW.client_id,
      NEW.client_email
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_auto_assign_job_customer_id ON public.jobs;
CREATE TRIGGER trigger_auto_assign_job_customer_id
  BEFORE INSERT OR UPDATE OF organization_id, business_id, client_id, client_email, customer_id
  ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_job_customer_id();

CREATE OR REPLACE FUNCTION public.auto_assign_invoice_customer_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.customer_id IS NULL THEN
    NEW.customer_id := public.resolve_customer_id_from_context(
      NEW.organization_id,
      NEW.business_id,
      NEW.client_id,
      NEW.client_email
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_auto_assign_invoice_customer_id ON public.invoices;
CREATE TRIGGER trigger_auto_assign_invoice_customer_id
  BEFORE INSERT OR UPDATE OF organization_id, business_id, client_id, client_email, customer_id
  ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_invoice_customer_id();

-- Backfill rows that pre-date the trigger
UPDATE public.jobs j
SET customer_id = c.id
FROM public.customers c
LEFT JOIN public.clients cl ON cl.id = j.client_id
LEFT JOIN public.business_info bi ON bi.id = j.business_id
WHERE j.customer_id IS NULL
  AND c.organization_id = COALESCE(j.organization_id, cl.organization_id, bi.organization_id)
  AND LOWER(c.email) = LOWER(COALESCE(NULLIF(BTRIM(j.client_email), ''), NULLIF(BTRIM(cl.email), '')))
  AND COALESCE(NULLIF(BTRIM(j.client_email), ''), NULLIF(BTRIM(cl.email), '')) IS NOT NULL;

UPDATE public.invoices i
SET customer_id = c.id
FROM public.customers c
LEFT JOIN public.clients cl ON cl.id = i.client_id
LEFT JOIN public.business_info bi ON bi.id = i.business_id
WHERE i.customer_id IS NULL
  AND c.organization_id = COALESCE(i.organization_id, cl.organization_id, bi.organization_id)
  AND LOWER(c.email) = LOWER(COALESCE(NULLIF(BTRIM(i.client_email), ''), NULLIF(BTRIM(cl.email), '')))
  AND COALESCE(NULLIF(BTRIM(i.client_email), ''), NULLIF(BTRIM(cl.email), '')) IS NOT NULL;
