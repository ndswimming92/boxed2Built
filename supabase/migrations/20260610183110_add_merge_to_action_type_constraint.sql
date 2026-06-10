-- Add 'MERGE' to the allowed action_type values in admin_audit_logs
ALTER TABLE admin_audit_logs DROP CONSTRAINT check_action_type;
ALTER TABLE admin_audit_logs ADD CONSTRAINT check_action_type CHECK (
  action_type = ANY (ARRAY[
    'CREATE', 'UPDATE', 'DELETE', 'ARCHIVE', 'RESTORE',
    'LOGIN', 'LOGOUT', 'EXPORT', 'IMPORT', 'SEND_EMAIL',
    'UPLOAD', 'DOWNLOAD', 'VIEW', 'APPROVE', 'REJECT', 'SUBMIT', 'MERGE'
  ])
);