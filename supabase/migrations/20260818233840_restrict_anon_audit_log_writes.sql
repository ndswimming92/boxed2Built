/*
  # Stop anonymous callers writing arbitrary audit log entries

  1. Problem
     Policy "Authenticated and public users can create audit logs" allowed the
     `anon` role to INSERT any row into `admin_audit_logs` as long as
     `action_type` and `table_name` were non-null. Anyone could forge entries
     attributed to any user or organization, or flood the table.

  2. Changes
     - Drop that policy. Signed-in users get a narrowed INSERT policy that
       requires the row to belong to an organization they can see and to be
       attributed either to themselves or to no user.
     - Add `log_public_audit_event(...)`, a rate-limited SECURITY DEFINER
       function for the public contact forms. It forces `user_id` to NULL,
       fills in the organization and the request IP server-side, and accepts
       only the action/table combinations the public site actually produces.

  3. Security
     Reads are unchanged (org members and platform admins only).
*/

DROP POLICY IF EXISTS "Authenticated and public users can create audit logs" ON public.admin_audit_logs;

CREATE POLICY "Members can create audit logs"
  ON public.admin_audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    action_type IS NOT NULL
    AND table_name IS NOT NULL
    AND organization_id IS NOT NULL
    AND can_view_org_data(organization_id)
    AND (user_id IS NULL OR user_id = auth.uid())
  );

CREATE OR REPLACE FUNCTION public.log_public_audit_event(
  p_action_type text,
  p_table_name text,
  p_user_email text,
  p_record_id uuid DEFAULT NULL,
  p_record_identifier text DEFAULT NULL,
  p_status text DEFAULT 'success',
  p_error_message text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
VOLATILE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_ip text;
  v_org uuid;
  v_recent integer;
BEGIN
  -- Only the shapes the public website actually emits.
  IF p_action_type IS NULL OR p_action_type NOT IN ('SUBMIT') THEN
    RETURN;
  END IF;
  IF p_table_name IS NULL OR p_table_name NOT IN ('form_inquiries', 'saved_requests') THEN
    RETURN;
  END IF;
  IF p_status IS NULL OR p_status NOT IN ('success', 'error') THEN
    RETURN;
  END IF;

  v_ip := COALESCE(public.get_request_ip_from_headers(), 'unknown');

  SELECT count(*) INTO v_recent
  FROM public.admin_audit_logs a
  WHERE a.ip_address = v_ip
    AND a.user_id IS NULL
    AND a.created_at > now() - interval '15 minutes';

  IF v_recent >= 20 THEN
    RETURN;
  END IF;

  SELECT id INTO v_org FROM public.organizations ORDER BY created_at LIMIT 1;
  IF v_org IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.admin_audit_logs (
    organization_id, user_id, user_email, action_type, table_name,
    record_id, record_identifier, status, error_message,
    ip_address, metadata
  ) VALUES (
    v_org,
    NULL,
    left(COALESCE(p_user_email, 'unknown'), 320),
    p_action_type,
    p_table_name,
    p_record_id,
    left(COALESCE(p_record_identifier, ''), 300),
    p_status,
    left(COALESCE(p_error_message, ''), 500),
    v_ip,
    COALESCE(p_metadata, '{}'::jsonb) || jsonb_build_object('public_submission', true)
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.log_public_audit_event(text, text, text, uuid, text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_public_audit_event(text, text, text, uuid, text, text, text, jsonb) TO anon, authenticated;
