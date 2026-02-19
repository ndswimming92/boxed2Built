/*
  # Tighten RLS Policies That Were Always True

  ## Summary
  Replaces overly permissive INSERT policies (WITH CHECK (true)) with constrained
  versions that enforce meaningful data integrity rules. These tables accept
  public/anonymous submissions by design, but we add checks to prevent trivially
  malformed data from being inserted.

  ## Changes

  ### admin_audit_logs
  - Policy "Anyone can create audit logs for form submissions": constrained to
    require action_type is not null and table_name is not null.

  ### form_inquiries
  - Policy "Anyone can submit form inquiries": constrained to require
    client_name is not null and non-empty, and business_id is not null.

  ### organizations
  - Policy "Authenticated users can create organizations": constrained so the
    inserting user's auth.uid() is non-null (already guaranteed for authenticated
    role, but makes the intent explicit).

  ### qr_scans
  - Policy "Anyone can create qr scans": constrained to require qr_code_id is
    not null (every scan must reference a valid QR code).

  ### saved_requests
  - Policy "Anyone can create saved requests": constrained to require
    business_id is not null and client_name is not null and non-empty.
  - Policy "Service role can insert saved requests": kept permissive but scoped
    to service_role only (already is — no change needed for service_role bypass).
*/

-- admin_audit_logs
DROP POLICY IF EXISTS "Anyone can create audit logs for form submissions" ON public.admin_audit_logs;
CREATE POLICY "Anyone can create audit logs for form submissions"
  ON public.admin_audit_logs
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    action_type IS NOT NULL
    AND table_name IS NOT NULL
  );

-- form_inquiries
DROP POLICY IF EXISTS "Anyone can submit form inquiries" ON public.form_inquiries;
CREATE POLICY "Anyone can submit form inquiries"
  ON public.form_inquiries
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    business_id IS NOT NULL
    AND client_name IS NOT NULL
    AND client_name <> ''
  );

-- organizations
DROP POLICY IF EXISTS "Authenticated users can create organizations" ON public.organizations;
CREATE POLICY "Authenticated users can create organizations"
  ON public.organizations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND name IS NOT NULL
    AND name <> ''
  );

-- qr_scans
DROP POLICY IF EXISTS "Anyone can create qr scans" ON public.qr_scans;
CREATE POLICY "Anyone can create qr scans"
  ON public.qr_scans
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    qr_code_id IS NOT NULL
  );

-- saved_requests
DROP POLICY IF EXISTS "Anyone can create saved requests" ON public.saved_requests;
CREATE POLICY "Anyone can create saved requests"
  ON public.saved_requests
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    business_id IS NOT NULL
    AND client_name IS NOT NULL
    AND client_name <> ''
  );
