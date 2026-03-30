/*
  # Fix portal documents visibility for customers with multiple records

  ## Problem
  The portal_documents RLS policy uses `owner_customer_id = public.current_customer_id()`.
  The `current_customer_id()` function returns only ONE customer record (the oldest one
  with auth_user_id = auth.uid()). If the same person has multiple customer records
  (e.g. registered with different emails, or the admin uploaded a document to a
  different customer record than the one the portal user is authenticated as),
  the document will not be visible.

  ## Fix
  1. Create a new helper function `current_customer_ids()` that returns ALL customer
     UUIDs linked to the current auth user.
  2. Update the portal_documents SELECT RLS policy to use ANY(current_customer_ids())
     so all linked customer records are considered.
  3. Update the storage objects SELECT policy similarly.
  4. Update the portal_document_audit_events policy as well.

  ## Security
  - Only authenticated users can call these functions.
  - Users still cannot see documents owned by other people's customer records.
*/

-- 1. Create helper that returns ALL customer IDs for the current auth user
CREATE OR REPLACE FUNCTION public.current_customer_ids()
  RETURNS uuid[]
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT ARRAY(
    SELECT c.id
    FROM public.customers c
    WHERE c.auth_user_id = auth.uid()
  );
$$;

-- 2. Replace the portal_documents SELECT policy to use the array version
DROP POLICY IF EXISTS "Customers can view owned portal documents" ON public.portal_documents;

CREATE POLICY "Customers can view owned portal documents"
  ON public.portal_documents
  FOR SELECT
  TO authenticated
  USING (
    owner_customer_id = ANY(public.current_customer_ids())
    AND is_visible_to_customer = true
    AND deleted_at IS NULL
  );

-- 3. Replace the storage objects SELECT policy to allow any linked customer folder
DROP POLICY IF EXISTS "Customers can read own portal vault objects" ON storage.objects;

CREATE POLICY "Customers can read own portal vault objects"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'portal-document-vault'
    AND split_part(name, '/', 1) = ANY(
      SELECT c.id::text
      FROM public.customers c
      WHERE c.auth_user_id = auth.uid()
    )
  );

-- 4. Update portal_document_audit_events SELECT policy to use array
DROP POLICY IF EXISTS "Customers can view own document audit events" ON public.portal_document_audit_events;

CREATE POLICY "Customers can view own document audit events"
  ON public.portal_document_audit_events
  FOR SELECT
  TO authenticated
  USING (customer_id = ANY(public.current_customer_ids()));

-- 5. Update portal_document_audit_events INSERT policy to use array
DROP POLICY IF EXISTS "Customers can insert own document audit events" ON public.portal_document_audit_events;

CREATE POLICY "Customers can insert own document audit events"
  ON public.portal_document_audit_events
  FOR INSERT
  TO authenticated
  WITH CHECK (customer_id = ANY(public.current_customer_ids()));
