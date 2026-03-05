/*
  # Add SUBMIT to admin_audit_logs check_action_type constraint

  ## Summary
  The database constraint `check_action_type` on `admin_audit_logs` was missing the
  'SUBMIT' action type. The TypeScript code already uses 'SUBMIT' for public form
  submissions (ContactForm and QuickContactForm), causing a 400 Bad Request error
  whenever a user submits a contact form.

  ## Changes
  - Drops the existing `check_action_type` constraint
  - Recreates it with 'SUBMIT' added to the allowed values

  ## Allowed action_type values after this migration
  CREATE, UPDATE, DELETE, ARCHIVE, RESTORE, LOGIN, LOGOUT, EXPORT, IMPORT,
  SEND_EMAIL, UPLOAD, DOWNLOAD, VIEW, APPROVE, REJECT, SUBMIT
*/

ALTER TABLE admin_audit_logs
DROP CONSTRAINT IF EXISTS check_action_type;

ALTER TABLE admin_audit_logs
ADD CONSTRAINT check_action_type
CHECK (action_type IN (
  'CREATE', 'UPDATE', 'DELETE', 'ARCHIVE', 'RESTORE',
  'LOGIN', 'LOGOUT', 'EXPORT', 'IMPORT', 'SEND_EMAIL',
  'UPLOAD', 'DOWNLOAD', 'VIEW', 'APPROVE', 'REJECT', 'SUBMIT'
));
