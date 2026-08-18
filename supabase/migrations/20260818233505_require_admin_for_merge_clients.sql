/*
  # Require admin rights to merge client records

  1. Problem
     `public.merge_clients` is SECURITY DEFINER and had no authorization check
     at all, while EXECUTE was held by `anon` and `authenticated`. Any caller
     holding the public anon key could reassign a client's jobs, invoices,
     inquiries and notes and then permanently DELETE the discarded client row.

  2. Changes
     - Recreate the function with the same behaviour, but reject the call
       unless the caller is signed in AND is a platform admin or holds the
       'admin' role in the organization that owns both client records.
     - Revoke EXECUTE from `anon` and from PUBLIC; grant it to `authenticated`
       only (the in-body check still applies).

  3. Security
     The check runs before any UPDATE, INSERT or DELETE in the function body.
*/

CREATE OR REPLACE FUNCTION public.merge_clients(p_keep_client_id uuid, p_discard_client_id uuid)
RETURNS public.clients
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_keep    public.clients;
  v_discard public.clients;
  v_result  public.clients;
  v_jobs_moved    int;
  v_invoices_moved int;
  v_inquiries_moved int;
  v_notes_moved   int;
  v_user_id uuid;
  v_user_email text;
BEGIN
  -- Validate inputs
  IF p_keep_client_id = p_discard_client_id THEN
    RAISE EXCEPTION 'Cannot merge a client with itself';
  END IF;

  -- Get current user info for audit log
  v_user_id := auth.uid();

  -- Authorization: merging is destructive, so the caller must be signed in.
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authorized to merge clients';
  END IF;

  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;

  -- Lock both rows to prevent concurrent modifications
  SELECT * INTO v_keep FROM public.clients WHERE id = p_keep_client_id FOR UPDATE;
  SELECT * INTO v_discard FROM public.clients WHERE id = p_discard_client_id FOR UPDATE;

  IF v_keep IS NULL THEN
    RAISE EXCEPTION 'Keep client not found';
  END IF;
  IF v_discard IS NULL THEN
    RAISE EXCEPTION 'Discard client not found';
  END IF;

  -- They must be in the same organization
  IF v_keep.organization_id != v_discard.organization_id THEN
    RAISE EXCEPTION 'Cannot merge clients from different organizations';
  END IF;

  -- Authorization: platform admins, or organization admins/owners of the
  -- organization that owns both records.
  IF NOT (
    public.is_platform_admin()
    OR public.has_org_permission(v_keep.organization_id, 'admin')
  ) THEN
    RAISE EXCEPTION 'Not authorized to merge clients';
  END IF;

  -- 1. Reassign jobs
  UPDATE public.jobs SET client_id = p_keep_client_id WHERE client_id = p_discard_client_id;
  GET DIAGNOSTICS v_jobs_moved = ROW_COUNT;

  -- 2. Reassign invoices
  UPDATE public.invoices SET client_id = p_keep_client_id WHERE client_id = p_discard_client_id;
  GET DIAGNOSTICS v_invoices_moved = ROW_COUNT;

  -- 3. Reassign form inquiries
  UPDATE public.form_inquiries SET client_id = p_keep_client_id WHERE client_id = p_discard_client_id;
  GET DIAGNOSTICS v_inquiries_moved = ROW_COUNT;

  -- 4. Reassign client notes
  UPDATE public.client_notes SET client_id = p_keep_client_id WHERE client_id = p_discard_client_id;
  GET DIAGNOSTICS v_notes_moved = ROW_COUNT;

  -- 5. Reassign referral references (clients referred by the discarded client)
  UPDATE public.clients
  SET referred_by_client_id = p_keep_client_id
  WHERE referred_by_client_id = p_discard_client_id
    AND id != p_keep_client_id;

  -- 6. Backfill empty fields on keep client from discard client
  UPDATE public.clients SET
    email   = COALESCE(v_keep.email, v_discard.email),
    phone   = COALESCE(v_keep.phone, v_discard.phone),
    address = COALESCE(v_keep.address, v_discard.address),
    source  = COALESCE(v_keep.source, v_discard.source),
    tags    = (
      SELECT COALESCE(array_agg(DISTINCT t), '{}')
      FROM unnest(COALESCE(v_keep.tags, '{}') || COALESCE(v_discard.tags, '{}')) AS t
    ),
    referral_credit_balance = COALESCE(v_keep.referral_credit_balance, 0) + COALESCE(v_discard.referral_credit_balance, 0),
    referral_credit_used    = COALESCE(v_keep.referral_credit_used, 0) + COALESCE(v_discard.referral_credit_used, 0),
    created_at = LEAST(v_keep.created_at, v_discard.created_at)
  WHERE id = p_keep_client_id;

  -- 7. Insert a system note documenting the merge
  INSERT INTO public.client_notes (client_id, organization_id, note, created_by)
  VALUES (
    p_keep_client_id,
    v_keep.organization_id,
    format(
      '[SYSTEM] Merged with client "%s" (email: %s, phone: %s) on %s. Transferred: %s jobs, %s invoices, %s inquiries, %s notes.',
      v_discard.name,
      COALESCE(v_discard.email, 'none'),
      COALESCE(v_discard.phone, 'none'),
      to_char(now() AT TIME ZONE 'America/Chicago', 'Mon DD, YYYY'),
      v_jobs_moved,
      v_invoices_moved,
      v_inquiries_moved,
      v_notes_moved
    ),
    v_user_id
  );

  -- 8. Log to audit trail
  INSERT INTO public.admin_audit_logs (organization_id, user_id, user_email, action_type, table_name, record_id, record_identifier, metadata)
  VALUES (
    v_keep.organization_id,
    v_user_id,
    COALESCE(v_user_email, 'system'),
    'MERGE',
    'clients',
    p_keep_client_id,
    v_keep.name,
    jsonb_build_object(
      'keep_client_id', p_keep_client_id,
      'discard_client_id', p_discard_client_id,
      'discard_client_name', v_discard.name,
      'jobs_moved', v_jobs_moved,
      'invoices_moved', v_invoices_moved,
      'inquiries_moved', v_inquiries_moved,
      'notes_moved', v_notes_moved
    )
  );

  -- 9. Delete the discarded client (cascade deletes its client_notes)
  DELETE FROM public.clients WHERE id = p_discard_client_id;

  -- 10. Recalculate metrics on the surviving client
  PERFORM public.update_client_metrics(p_keep_client_id);

  -- Return the updated client record
  SELECT * INTO v_result FROM public.clients WHERE id = p_keep_client_id;
  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.merge_clients(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.merge_clients(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.merge_clients(uuid, uuid) TO authenticated;
