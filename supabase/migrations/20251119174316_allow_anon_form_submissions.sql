/*
  # Allow Anonymous Form Submissions

  ## Summary
  This migration fixes the form submission error on mobile browsers (iPhone Chrome, etc.) by allowing
  anonymous (unauthenticated) users to submit contact form inquiries.

  ## Problem
  The form_inquiries table has Row-Level Security (RLS) enabled, but only authenticated users could
  INSERT records. When public users submit the contact form, they are anonymous (anon role), and the
  RLS policies blocked their submissions with the error:
  "new row violates row-level security policy for table 'form_inquiries'"

  ## Solution
  Add an RLS policy that explicitly allows anonymous users (anon role) to INSERT into form_inquiries.
  This enables public form submissions while maintaining security for all other operations.

  ## Security Model
  - Anonymous users (anon role): Can ONLY INSERT new inquiries (public form submissions)
  - Anonymous users CANNOT: SELECT, UPDATE, or DELETE inquiries
  - Authenticated users (admin): Full access to SELECT, INSERT, UPDATE, DELETE inquiries
  - Only authenticated admins can view and manage all inquiries

  ## Changes
  1. Drop existing INSERT policy for authenticated users
  2. Create new INSERT policy for anonymous users (allows public submissions)
  3. Recreate INSERT policy for authenticated users (maintains admin capabilities)

  ## Testing
  After applying this migration:
  - Public users can submit contact forms without authentication
  - Confirmation modals and saved requests work correctly
  - Admin users retain full inquiry management capabilities
  - Anonymous users still cannot view other users' inquiries

  ## Rollback
  To rollback, remove the anonymous INSERT policy:
  ```sql
  DROP POLICY IF EXISTS "Anonymous users can submit inquiries" ON form_inquiries;
  ```
*/

-- Drop existing INSERT policy for authenticated users
-- We'll recreate it after adding the anonymous policy
DROP POLICY IF EXISTS "Authenticated users can insert inquiries" ON form_inquiries;

-- Create INSERT policy for anonymous users (public form submissions)
-- This allows anyone to submit the contact form
CREATE POLICY "Anonymous users can submit inquiries"
  ON form_inquiries FOR INSERT
  TO anon
  WITH CHECK (true);

-- Recreate INSERT policy for authenticated users
-- This allows admin users to create inquiries manually
CREATE POLICY "Authenticated users can insert inquiries"
  ON form_inquiries FOR INSERT
  TO authenticated
  WITH CHECK (true);
