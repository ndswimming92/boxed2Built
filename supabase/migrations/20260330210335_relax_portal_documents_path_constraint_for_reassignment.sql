/*
  # Relax portal_documents storage path constraint

  ## Summary
  The original constraint required the storage_path prefix to exactly match
  the owner_customer_id. This prevents reassigning a document to a different
  customer record without moving the file in storage (which requires a separate
  service-role operation).

  The actual security boundary is the RLS policy, not the path prefix naming
  convention. This migration drops the path-owner constraint so that admins
  can reassign documents between customer records (e.g., when a client has
  multiple portal accounts and the document was uploaded to the wrong one).

  ## Changes
  - Drop the `portal_documents_owner_path_check` constraint
*/

ALTER TABLE public.portal_documents
  DROP CONSTRAINT IF EXISTS portal_documents_owner_path_check;
