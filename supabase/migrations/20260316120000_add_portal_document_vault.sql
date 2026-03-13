/*
  # Portal document vault with strict ownership controls

  ## Summary
  1) Adds customer-owned document metadata table (`portal_documents`).
  2) Adds per-type retention/deletion policy table (`document_retention_rules`) and trigger.
  3) Creates private storage bucket + customer-scoped object access policies.
  4) Adds customer-auditable download/view events for document access.
*/

CREATE TABLE IF NOT EXISTS public.document_retention_rules (
  document_type text PRIMARY KEY,
  retention_days integer NOT NULL CHECK (retention_days > 0),
  hard_delete_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.portal_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  owner_customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  document_type text NOT NULL,
  display_name text NOT NULL,
  storage_bucket text NOT NULL DEFAULT 'portal-document-vault',
  storage_path text NOT NULL,
  related_job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
  related_invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  is_visible_to_customer boolean NOT NULL DEFAULT true,
  is_internal_only boolean NOT NULL DEFAULT false,
  retention_days_override integer CHECK (retention_days_override IS NULL OR retention_days_override > 0),
  delete_after_at timestamptz,
  deleted_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT portal_documents_owner_path_check CHECK (
    split_part(storage_path, '/', 1) = owner_customer_id::text
  ),
  CONSTRAINT portal_documents_related_ref_check CHECK (
    related_job_id IS NOT NULL OR related_invoice_id IS NOT NULL OR document_type IN ('general', 'agreement', 'other')
  )
);

CREATE TABLE IF NOT EXISTS public.portal_document_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES public.portal_documents(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('view_signed_url_requested', 'download_signed_url_requested')),
  ip_address inet,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portal_documents_owner_created
  ON public.portal_documents(owner_customer_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_portal_documents_org_type
  ON public.portal_documents(organization_id, document_type);

CREATE INDEX IF NOT EXISTS idx_portal_documents_delete_after
  ON public.portal_documents(delete_after_at)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_portal_document_audit_events_doc_created
  ON public.portal_document_audit_events(document_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_portal_document_audit_events_customer_created
  ON public.portal_document_audit_events(customer_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.apply_portal_document_retention_rule()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_retention_days integer;
BEGIN
  SELECT r.retention_days
    INTO v_retention_days
  FROM public.document_retention_rules r
  WHERE r.document_type = NEW.document_type;

  v_retention_days := COALESCE(NEW.retention_days_override, v_retention_days, 365);

  IF NEW.delete_after_at IS NULL THEN
    NEW.delete_after_at := COALESCE(NEW.created_at, now()) + make_interval(days => v_retention_days);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_portal_documents_apply_retention ON public.portal_documents;
CREATE TRIGGER trg_portal_documents_apply_retention
  BEFORE INSERT ON public.portal_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_portal_document_retention_rule();

CREATE OR REPLACE FUNCTION public.set_portal_document_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_portal_documents_set_updated_at ON public.portal_documents;
CREATE TRIGGER trg_portal_documents_set_updated_at
  BEFORE UPDATE ON public.portal_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.set_portal_document_updated_at();

ALTER TABLE public.document_retention_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_document_audit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org admins can manage document retention rules" ON public.document_retention_rules;
CREATE POLICY "Org admins can manage document retention rules"
  ON public.document_retention_rules
  FOR ALL
  TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

DROP POLICY IF EXISTS "Customers can view owned portal documents" ON public.portal_documents;
CREATE POLICY "Customers can view owned portal documents"
  ON public.portal_documents
  FOR SELECT
  TO authenticated
  USING (
    owner_customer_id = public.current_customer_id()
    AND is_visible_to_customer = true
    AND deleted_at IS NULL
  );

DROP POLICY IF EXISTS "Org members can manage portal documents" ON public.portal_documents;
CREATE POLICY "Org members can manage portal documents"
  ON public.portal_documents
  FOR ALL
  TO authenticated
  USING (public.can_manage_org_settings(organization_id))
  WITH CHECK (public.can_manage_org_settings(organization_id));

DROP POLICY IF EXISTS "Customers can view own document audit events" ON public.portal_document_audit_events;
CREATE POLICY "Customers can view own document audit events"
  ON public.portal_document_audit_events
  FOR SELECT
  TO authenticated
  USING (customer_id = public.current_customer_id());

DROP POLICY IF EXISTS "Customers can insert own document audit events" ON public.portal_document_audit_events;
CREATE POLICY "Customers can insert own document audit events"
  ON public.portal_document_audit_events
  FOR INSERT
  TO authenticated
  WITH CHECK (customer_id = public.current_customer_id());

DROP POLICY IF EXISTS "Org members can view document audit events" ON public.portal_document_audit_events;
CREATE POLICY "Org members can view document audit events"
  ON public.portal_document_audit_events
  FOR SELECT
  TO authenticated
  USING (public.can_view_org_data(organization_id));

INSERT INTO storage.buckets (id, name, public)
VALUES ('portal-document-vault', 'portal-document-vault', false)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Customers can read own portal vault objects'
  ) THEN
    CREATE POLICY "Customers can read own portal vault objects"
      ON storage.objects
      FOR SELECT
      TO authenticated
      USING (
        bucket_id = 'portal-document-vault'
        AND split_part(name, '/', 1) = public.current_customer_id()::text
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Org members can manage portal vault objects'
  ) THEN
    CREATE POLICY "Org members can manage portal vault objects"
      ON storage.objects
      FOR ALL
      TO authenticated
      USING (
        bucket_id = 'portal-document-vault'
        AND public.is_platform_admin()
      )
      WITH CHECK (
        bucket_id = 'portal-document-vault'
        AND public.is_platform_admin()
      );
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.record_portal_document_access(
  p_document_id uuid,
  p_event_type text,
  p_ip_address inet DEFAULT NULL,
  p_user_agent text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_doc public.portal_documents%ROWTYPE;
  v_customer_id uuid := public.current_customer_id();
  v_event_id uuid;
BEGIN
  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'Portal access requires an authenticated customer account';
  END IF;

  SELECT *
    INTO v_doc
  FROM public.portal_documents d
  WHERE d.id = p_document_id
    AND d.deleted_at IS NULL
    AND d.owner_customer_id = v_customer_id
    AND d.is_visible_to_customer = true;

  IF v_doc.id IS NULL THEN
    RAISE EXCEPTION 'Document not found or inaccessible';
  END IF;

  IF v_doc.delete_after_at IS NOT NULL AND v_doc.delete_after_at <= now() THEN
    RAISE EXCEPTION 'Document retention period has expired';
  END IF;

  INSERT INTO public.portal_document_audit_events (
    organization_id,
    customer_id,
    document_id,
    event_type,
    ip_address,
    user_agent
  ) VALUES (
    v_doc.organization_id,
    v_customer_id,
    v_doc.id,
    CASE WHEN p_event_type = 'download' THEN 'download_signed_url_requested' ELSE 'view_signed_url_requested' END,
    p_ip_address,
    p_user_agent
  )
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_portal_document_access(uuid, text, inet, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_portal_document_access(uuid, text, inet, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_portal_document_access(uuid, text, inet, text) TO service_role;

CREATE OR REPLACE FUNCTION public.apply_portal_document_retention_cleanup()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.portal_documents d
  SET deleted_at = now()
  WHERE d.deleted_at IS NULL
    AND d.delete_after_at IS NOT NULL
    AND d.delete_after_at <= now();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_portal_document_retention_cleanup() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_portal_document_retention_cleanup() TO service_role;

INSERT INTO public.document_retention_rules (document_type, retention_days, hard_delete_enabled)
VALUES
  ('invoice', 2555, false),
  ('receipt', 2555, false),
  ('estimate', 1095, false),
  ('job_report', 1095, false),
  ('photo', 365, false),
  ('agreement', 2555, false),
  ('general', 730, false),
  ('other', 730, false)
ON CONFLICT (document_type) DO NOTHING;
