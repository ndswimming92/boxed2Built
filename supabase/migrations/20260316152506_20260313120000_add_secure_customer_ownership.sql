/*
  # Add secure customer ownership model

  ## Summary
  1. Create `customers` with stable UUID PK and optional `auth_user_id` mapping.
  2. Add unique identity constraints/indexes for deterministic customer lookup.
  3. Add `customer_id` FKs to customer-facing and customer-history tables.
  4. Backfill `customer_id` deterministically via (normalized_email + organization context).
  5. Queue rows needing manual review when matching is ambiguous or unavailable.
*/

CREATE TABLE IF NOT EXISTS public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  email text,
  full_name text,
  phone text,
  source text NOT NULL DEFAULT 'migration_backfill',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT customers_contact_check CHECK (
    COALESCE(NULLIF(BTRIM(email), ''), NULLIF(BTRIM(phone), ''), NULL) IS NOT NULL
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS customers_auth_user_id_unique
  ON public.customers(auth_user_id)
  WHERE auth_user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS customers_org_email_unique
  ON public.customers(organization_id, LOWER(email))
  WHERE email IS NOT NULL AND BTRIM(email) <> '';

CREATE INDEX IF NOT EXISTS customers_org_idx
  ON public.customers(organization_id);

CREATE INDEX IF NOT EXISTS customers_org_phone_idx
  ON public.customers(organization_id, phone)
  WHERE phone IS NOT NULL AND BTRIM(phone) <> '';

CREATE OR REPLACE FUNCTION public.update_customers_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_customers_set_updated_at ON public.customers;
CREATE TRIGGER trg_customers_set_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_customers_updated_at();

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'customers'
      AND policyname = 'Org members can view customers'
  ) THEN
    CREATE POLICY "Org members can view customers"
      ON public.customers FOR SELECT
      TO authenticated
      USING (public.can_view_org_data(organization_id));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'customers'
      AND policyname = 'Org admins can manage customers'
  ) THEN
    CREATE POLICY "Org admins can manage customers"
      ON public.customers FOR ALL
      TO authenticated
      USING (public.can_manage_org_settings(organization_id))
      WITH CHECK (public.can_manage_org_settings(organization_id));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.customer_identity_review_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_table text NOT NULL,
  source_pk uuid NOT NULL,
  organization_id uuid,
  business_id uuid,
  candidate_email text,
  reason text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'ignored')),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  notes text
);

CREATE UNIQUE INDEX IF NOT EXISTS customer_identity_review_queue_unique_source
  ON public.customer_identity_review_queue(source_table, source_pk);

CREATE INDEX IF NOT EXISTS customer_identity_review_queue_status_idx
  ON public.customer_identity_review_queue(status, created_at DESC);

ALTER TABLE public.customer_identity_review_queue ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'customer_identity_review_queue'
      AND policyname = 'Org admins can manage customer identity review queue'
  ) THEN
    CREATE POLICY "Org admins can manage customer identity review queue"
      ON public.customer_identity_review_queue FOR ALL
      TO authenticated
      USING (
        organization_id IS NULL
        OR public.can_manage_org_settings(organization_id)
      )
      WITH CHECK (
        organization_id IS NULL
        OR public.can_manage_org_settings(organization_id)
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'jobs' AND column_name = 'customer_id'
  ) THEN
    ALTER TABLE public.jobs
      ADD COLUMN customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'invoices' AND column_name = 'customer_id'
  ) THEN
    ALTER TABLE public.invoices
      ADD COLUMN customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'form_inquiries' AND column_name = 'customer_id'
  ) THEN
    ALTER TABLE public.form_inquiries
      ADD COLUMN customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'saved_requests' AND column_name = 'customer_id'
  ) THEN
    ALTER TABLE public.saved_requests
      ADD COLUMN customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'job_completions' AND column_name = 'customer_id'
  ) THEN
    ALTER TABLE public.job_completions
      ADD COLUMN customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_jobs_customer_id ON public.jobs(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_customer_id ON public.invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_form_inquiries_customer_id ON public.form_inquiries(customer_id);
CREATE INDEX IF NOT EXISTS idx_saved_requests_customer_id ON public.saved_requests(customer_id);
CREATE INDEX IF NOT EXISTS idx_job_completions_customer_id ON public.job_completions(customer_id);

WITH source_rows AS (
  SELECT
    c.organization_id,
    NULLIF(LOWER(BTRIM(c.email)), '') AS email_norm,
    NULLIF(BTRIM(c.name), '') AS full_name,
    NULLIF(BTRIM(c.phone), '') AS phone,
    'clients_table'::text AS source
  FROM public.clients c
  WHERE c.organization_id IS NOT NULL

  UNION ALL

  SELECT
    COALESCE(j.organization_id, bi.organization_id) AS organization_id,
    NULLIF(LOWER(BTRIM(j.client_email)), '') AS email_norm,
    NULLIF(BTRIM(j.client_name), '') AS full_name,
    NULLIF(BTRIM(j.client_phone), '') AS phone,
    'jobs_backfill'::text AS source
  FROM public.jobs j
  LEFT JOIN public.business_info bi ON bi.id = j.business_id

  UNION ALL

  SELECT
    COALESCE(i.organization_id, bi.organization_id) AS organization_id,
    NULLIF(LOWER(BTRIM(i.client_email)), '') AS email_norm,
    NULLIF(BTRIM(i.client_name), '') AS full_name,
    NULLIF(BTRIM(i.client_phone), '') AS phone,
    'invoices_backfill'::text AS source
  FROM public.invoices i
  LEFT JOIN public.business_info bi ON bi.id = i.business_id

  UNION ALL

  SELECT
    COALESCE(fi.organization_id, bi.organization_id) AS organization_id,
    NULLIF(LOWER(BTRIM(fi.client_email)), '') AS email_norm,
    NULLIF(BTRIM(fi.client_name), '') AS full_name,
    NULLIF(BTRIM(fi.client_phone), '') AS phone,
    'form_inquiries_backfill'::text AS source
  FROM public.form_inquiries fi
  LEFT JOIN public.business_info bi ON bi.id = fi.business_id

  UNION ALL

  SELECT
    COALESCE(sr.organization_id, bi.organization_id) AS organization_id,
    NULLIF(LOWER(BTRIM(sr.client_email)), '') AS email_norm,
    NULLIF(BTRIM(sr.client_name), '') AS full_name,
    NULLIF(BTRIM(sr.client_phone), '') AS phone,
    'saved_requests_backfill'::text AS source
  FROM public.saved_requests sr
  LEFT JOIN public.business_info bi ON bi.id = sr.business_id
), dedup AS (
  SELECT
    organization_id,
    email_norm,
    MAX(full_name) AS full_name,
    MAX(phone) AS phone,
    MIN(source) AS source
  FROM source_rows
  WHERE organization_id IS NOT NULL
    AND email_norm IS NOT NULL
  GROUP BY organization_id, email_norm
)
INSERT INTO public.customers (organization_id, email, full_name, phone, source)
SELECT d.organization_id, d.email_norm, d.full_name, d.phone, d.source
FROM dedup d
LEFT JOIN public.customers c
  ON c.organization_id = d.organization_id
 AND LOWER(c.email) = d.email_norm
WHERE c.id IS NULL;

UPDATE public.jobs j
SET customer_id = c.id
FROM public.customers c
WHERE j.customer_id IS NULL
  AND c.organization_id = COALESCE(j.organization_id, (SELECT bi.organization_id FROM public.business_info bi WHERE bi.id = j.business_id))
  AND LOWER(c.email) = LOWER(j.client_email)
  AND NULLIF(BTRIM(j.client_email), '') IS NOT NULL;

UPDATE public.invoices i
SET customer_id = c.id
FROM public.customers c
WHERE i.customer_id IS NULL
  AND c.organization_id = COALESCE(i.organization_id, (SELECT bi.organization_id FROM public.business_info bi WHERE bi.id = i.business_id))
  AND LOWER(c.email) = LOWER(i.client_email)
  AND NULLIF(BTRIM(i.client_email), '') IS NOT NULL;

UPDATE public.form_inquiries fi
SET customer_id = c.id
FROM public.customers c
WHERE fi.customer_id IS NULL
  AND c.organization_id = COALESCE(fi.organization_id, (SELECT bi.organization_id FROM public.business_info bi WHERE bi.id = fi.business_id))
  AND LOWER(c.email) = LOWER(fi.client_email)
  AND NULLIF(BTRIM(fi.client_email), '') IS NOT NULL;

UPDATE public.saved_requests sr
SET customer_id = c.id
FROM public.customers c
WHERE sr.customer_id IS NULL
  AND c.organization_id = COALESCE(sr.organization_id, (SELECT bi.organization_id FROM public.business_info bi WHERE bi.id = sr.business_id))
  AND LOWER(c.email) = LOWER(sr.client_email)
  AND NULLIF(BTRIM(sr.client_email), '') IS NOT NULL;

UPDATE public.job_completions jc
SET customer_id = j.customer_id
FROM public.jobs j
WHERE jc.customer_id IS NULL
  AND jc.job_id = j.id
  AND j.customer_id IS NOT NULL;

INSERT INTO public.customer_identity_review_queue (
  source_table, source_pk, organization_id, business_id, candidate_email, reason, payload
)
SELECT
  'jobs',
  j.id,
  COALESCE(j.organization_id, bi.organization_id),
  j.business_id,
  j.client_email,
  CASE
    WHEN NULLIF(BTRIM(j.client_email), '') IS NULL THEN 'missing_email'
    WHEN COALESCE(j.organization_id, bi.organization_id) IS NULL THEN 'missing_organization_context'
    ELSE 'no_customer_match'
  END,
  jsonb_build_object(
    'client_name', j.client_name,
    'client_phone', j.client_phone,
    'job_type', j.job_type
  )
FROM public.jobs j
LEFT JOIN public.business_info bi ON bi.id = j.business_id
WHERE j.customer_id IS NULL
ON CONFLICT (source_table, source_pk) DO NOTHING;

INSERT INTO public.customer_identity_review_queue (
  source_table, source_pk, organization_id, business_id, candidate_email, reason, payload
)
SELECT
  'invoices',
  i.id,
  COALESCE(i.organization_id, bi.organization_id),
  i.business_id,
  i.client_email,
  CASE
    WHEN NULLIF(BTRIM(i.client_email), '') IS NULL THEN 'missing_email'
    WHEN COALESCE(i.organization_id, bi.organization_id) IS NULL THEN 'missing_organization_context'
    ELSE 'no_customer_match'
  END,
  jsonb_build_object(
    'invoice_number', i.invoice_number,
    'client_name', i.client_name,
    'client_phone', i.client_phone
  )
FROM public.invoices i
LEFT JOIN public.business_info bi ON bi.id = i.business_id
WHERE i.customer_id IS NULL
ON CONFLICT (source_table, source_pk) DO NOTHING;

INSERT INTO public.customer_identity_review_queue (
  source_table, source_pk, organization_id, business_id, candidate_email, reason, payload
)
SELECT
  'form_inquiries',
  fi.id,
  COALESCE(fi.organization_id, bi.organization_id),
  fi.business_id,
  fi.client_email,
  CASE
    WHEN NULLIF(BTRIM(fi.client_email), '') IS NULL THEN 'missing_email'
    WHEN COALESCE(fi.organization_id, bi.organization_id) IS NULL THEN 'missing_organization_context'
    ELSE 'no_customer_match'
  END,
  jsonb_build_object(
    'client_name', fi.client_name,
    'client_phone', fi.client_phone
  )
FROM public.form_inquiries fi
LEFT JOIN public.business_info bi ON bi.id = fi.business_id
WHERE fi.customer_id IS NULL
ON CONFLICT (source_table, source_pk) DO NOTHING;

INSERT INTO public.customer_identity_review_queue (
  source_table, source_pk, organization_id, business_id, candidate_email, reason, payload
)
SELECT
  'saved_requests',
  sr.id,
  COALESCE(sr.organization_id, bi.organization_id),
  sr.business_id,
  sr.client_email,
  CASE
    WHEN NULLIF(BTRIM(sr.client_email), '') IS NULL THEN 'missing_email'
    WHEN COALESCE(sr.organization_id, bi.organization_id) IS NULL THEN 'missing_organization_context'
    ELSE 'no_customer_match'
  END,
  jsonb_build_object(
    'client_name', sr.client_name,
    'client_phone', sr.client_phone,
    'confirmation_code', sr.confirmation_code
  )
FROM public.saved_requests sr
LEFT JOIN public.business_info bi ON bi.id = sr.business_id
WHERE sr.customer_id IS NULL
ON CONFLICT (source_table, source_pk) DO NOTHING;
