/*
  # Allow Public Form Submission Audit Logs

  ## Summary
  Updates the admin_audit_logs table RLS policy to allow anonymous users (public form submissions) 
  to create audit log entries. This enables tracking of both successful and failed form submissions 
  from the website contact forms.

  ## Changes
  1. Security
     - Update INSERT policy on admin_audit_logs to allow both `anon` and `authenticated` users
     - Maintains existing SELECT restrictions (only authenticated organization members can view logs)
     - Maintains audit log immutability (no UPDATE policy)

  ## Notes
  - Public users can only INSERT logs, not view or modify them
  - This allows form submissions to be tracked even when users are not logged in
  - Logs from public submissions are marked with `public_submission: true` in metadata
  - All form submission logs include user email for identification
*/

-- Drop existing INSERT policy for audit logs
DROP POLICY IF EXISTS "All authenticated users can create audit logs" ON admin_audit_logs;

-- Create new policy that allows both authenticated and anonymous users to insert audit logs
CREATE POLICY "Anyone can create audit logs for form submissions"
  ON admin_audit_logs FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Note: SELECT policies remain unchanged - only authenticated org members can view logs
-- Note: Audit logs remain immutable - no UPDATE policy
-- Note: Only platform admins can DELETE logs (via existing platform admin policy)
