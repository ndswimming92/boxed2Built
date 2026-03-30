/*
  # Fix portal vault storage read policy to use document table ownership

  ## Problem
  The storage objects read policy checks the path prefix against current_customer_ids().
  After relaxing the path-owner constraint and allowing document reassignment,
  a file's storage path prefix may no longer match the document's owner_customer_id.
  The portal customer would be denied the signed-URL access.

  ## Fix
  Replace the path-prefix check with a lookup against the portal_documents table,
  which holds the authoritative owner. If a portal_documents row exists for this
  storage object AND is owned by the current customer AND is visible, allow access.

  This is more secure: access is gated on the document record, not just the path.
*/

DROP POLICY IF EXISTS "Customers can read own portal vault objects" ON storage.objects;

CREATE POLICY "Customers can read own portal vault objects"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'portal-document-vault'
    AND EXISTS (
      SELECT 1
      FROM public.portal_documents pd
      WHERE pd.storage_path = name
        AND pd.owner_customer_id = ANY(public.current_customer_ids())
        AND pd.is_visible_to_customer = true
        AND pd.deleted_at IS NULL
    )
  );
