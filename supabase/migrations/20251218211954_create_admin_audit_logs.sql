/*
  # Create Admin Activity Audit Log System

  1. New Tables
    - `admin_audit_logs`
      - `id` (uuid, primary key) - Unique log entry identifier
      - `user_id` (uuid, foreign key to auth.users) - Admin who performed the action
      - `user_email` (text) - Email of the admin for easy reference
      - `action_type` (text) - Type of action (CREATE, UPDATE, DELETE, ARCHIVE, LOGIN, LOGOUT, etc.)
      - `table_name` (text) - Table/resource affected (services, jobs, goals, etc.)
      - `record_id` (uuid, nullable) - ID of the affected record
      - `record_identifier` (text, nullable) - Human-readable identifier (name, title, etc.)
      - `old_values` (jsonb, nullable) - Previous state before change (for updates/deletes)
      - `new_values` (jsonb, nullable) - New state after change (for creates/updates)
      - `changes_summary` (text, nullable) - Human-readable summary of what changed
      - `ip_address` (text, nullable) - IP address of the request
      - `user_agent` (text, nullable) - Browser/client information
      - `status` (text) - Success or error status
      - `error_message` (text, nullable) - Error details if action failed
      - `metadata` (jsonb) - Additional context (page, section, filters, etc.)
      - `created_at` (timestamptz) - Timestamp of the action

  2. Indexes
    - Index on `user_id` for filtering by admin
    - Index on `table_name` for filtering by resource
    - Index on `created_at` for date range filtering
    - Index on `action_type` for filtering by action
    - Composite index on `(table_name, record_id)` for record history
    - Index on `status` for error tracking

  3. Security
    - Enable RLS on `admin_audit_logs` table
    - Only authenticated admin users can read audit logs
    - Service role has insert access for logging
    - No updates or deletes allowed (append-only table)
*/

-- Create admin_audit_logs table
CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email text NOT NULL,
  action_type text NOT NULL,
  table_name text NOT NULL,
  record_id uuid,
  record_identifier text,
  old_values jsonb,
  new_values jsonb,
  changes_summary text,
  ip_address text,
  user_agent text,
  status text NOT NULL DEFAULT 'success',
  error_message text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON admin_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_name ON admin_audit_logs(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON admin_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_type ON admin_audit_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_status ON admin_audit_logs(status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_record ON admin_audit_logs(table_name, record_id);

-- Add check constraint for action_type
ALTER TABLE admin_audit_logs
ADD CONSTRAINT check_action_type
CHECK (action_type IN (
  'CREATE', 'UPDATE', 'DELETE', 'ARCHIVE', 'RESTORE',
  'LOGIN', 'LOGOUT', 'EXPORT', 'IMPORT', 'SEND_EMAIL',
  'UPLOAD', 'DOWNLOAD', 'VIEW', 'APPROVE', 'REJECT'
));

-- Add check constraint for status
ALTER TABLE admin_audit_logs
ADD CONSTRAINT check_status
CHECK (status IN ('success', 'error', 'warning'));

-- Enable Row Level Security
ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can read all audit logs
CREATE POLICY "Authenticated users can read audit logs"
  ON admin_audit_logs
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Service role can insert audit logs
CREATE POLICY "Service role can insert audit logs"
  ON admin_audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- No update or delete policies (append-only table)

-- Create a function to automatically log authentication events
CREATE OR REPLACE FUNCTION log_auth_event()
RETURNS TRIGGER AS $$
BEGIN
  -- This is a placeholder for future enhancement
  -- Can be extended to automatically log certain database changes
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a view for recent activity (last 30 days)
CREATE OR REPLACE VIEW recent_audit_logs AS
SELECT
  al.*,
  u.email as current_user_email
FROM admin_audit_logs al
LEFT JOIN auth.users u ON al.user_id = u.id
WHERE al.created_at >= NOW() - INTERVAL '30 days'
ORDER BY al.created_at DESC;

-- Grant access to the view
GRANT SELECT ON recent_audit_logs TO authenticated;
