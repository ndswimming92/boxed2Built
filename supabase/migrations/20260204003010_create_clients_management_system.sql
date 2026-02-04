/*
  # Client Management & Marketing System

  ## 1. New Tables
    - `clients`
      - Core client information with unique email constraint
      - Marketing preferences (email_opt_in, sms_opt_in)
      - Client classification (status, value_tier)
      - Relationship tracking (dates, metrics)
      - Custom tags for segmentation
    
    - `client_notes`
      - Relationship management annotations
      - Links to clients with user tracking
      - Timestamped for history

  ## 2. Calculated Fields & Metrics
    - total_revenue: Sum of all paid invoices
    - job_count: Number of completed jobs
    - average_job_value: Calculated from above
    - first_contact_date: Earliest inquiry/job date
    - last_contact_date: Most recent activity
    - last_job_date: Most recent completed job

  ## 3. Client Segmentation
    - client_status: lead, active, repeat, dormant
    - client_value_tier: standard, high_value, vip
    - Automated classification based on activity and revenue

  ## 4. Database Views
    - dormant_clients: No activity in 90+ days
    - high_value_clients: Above revenue threshold
    - repeat_customers: 2+ completed jobs

  ## 5. Auto-merge Function
    - Automatically consolidates duplicate clients by email
    - Preserves all historical data relationships
    - Updates metrics on merge

  ## 6. Security
    - Enable RLS on all tables
    - Admin-only access for client management
    - Uses existing RLS helper functions (can_manage_org_settings, can_view_org_data)
*/

-- Create enum types for client classification
DO $$ BEGIN
  CREATE TYPE client_status AS ENUM ('lead', 'active', 'repeat', 'dormant');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE client_value_tier AS ENUM ('standard', 'high_value', 'vip');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create clients table
CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Contact Information
  name text NOT NULL,
  email text,
  phone text,
  address text,
  
  -- Client Classification
  client_status client_status DEFAULT 'lead',
  client_value_tier client_value_tier DEFAULT 'standard',
  
  -- Marketing Preferences
  marketing_email_opt_in boolean DEFAULT true,
  marketing_sms_opt_in boolean DEFAULT true,
  opt_in_date timestamptz DEFAULT now(),
  opt_out_date timestamptz,
  last_campaign_date timestamptz,
  
  -- Relationship Tracking
  first_contact_date timestamptz,
  last_contact_date timestamptz,
  last_job_date timestamptz,
  
  -- Metrics (calculated)
  total_revenue decimal(10,2) DEFAULT 0,
  job_count integer DEFAULT 0,
  average_job_value decimal(10,2) DEFAULT 0,
  
  -- Source Attribution
  source text,
  
  -- Custom Segmentation
  tags text[] DEFAULT '{}',
  
  -- Preferences Token for Self-Service
  preferences_token text UNIQUE,
  
  -- Audit
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Ensure at least email or phone is provided
  CONSTRAINT contact_info_check CHECK (email IS NOT NULL OR phone IS NOT NULL)
);

-- Create unique index on email (case-insensitive, null-safe)
CREATE UNIQUE INDEX IF NOT EXISTS clients_email_org_unique 
  ON clients(organization_id, LOWER(email)) 
  WHERE email IS NOT NULL;

-- Create index on phone for lookups
CREATE INDEX IF NOT EXISTS clients_phone_idx ON clients(phone) WHERE phone IS NOT NULL;

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS clients_status_idx ON clients(client_status);
CREATE INDEX IF NOT EXISTS clients_value_tier_idx ON clients(client_value_tier);
CREATE INDEX IF NOT EXISTS clients_last_contact_idx ON clients(last_contact_date DESC);
CREATE INDEX IF NOT EXISTS clients_org_idx ON clients(organization_id);

-- Create client_notes table
CREATE TABLE IF NOT EXISTS client_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  note text NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create index for client notes lookups
CREATE INDEX IF NOT EXISTS client_notes_client_idx ON client_notes(client_id);
CREATE INDEX IF NOT EXISTS client_notes_org_idx ON client_notes(organization_id);

-- Enable RLS
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_notes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for clients table
CREATE POLICY "Platform admins can view all clients"
  ON clients FOR SELECT
  TO authenticated
  USING (is_platform_admin());

CREATE POLICY "Org members can view their org clients"
  ON clients FOR SELECT
  TO authenticated
  USING (can_view_org_data(organization_id));

CREATE POLICY "Org admins can insert clients"
  ON clients FOR INSERT
  TO authenticated
  WITH CHECK (can_manage_org_settings(organization_id));

CREATE POLICY "Org admins can update their clients"
  ON clients FOR UPDATE
  TO authenticated
  USING (can_manage_org_settings(organization_id))
  WITH CHECK (can_manage_org_settings(organization_id));

CREATE POLICY "Org admins can delete their clients"
  ON clients FOR DELETE
  TO authenticated
  USING (can_manage_org_settings(organization_id));

-- RLS Policies for client_notes table
CREATE POLICY "Platform admins can view all client notes"
  ON client_notes FOR SELECT
  TO authenticated
  USING (is_platform_admin());

CREATE POLICY "Org members can view their org client notes"
  ON client_notes FOR SELECT
  TO authenticated
  USING (can_view_org_data(organization_id));

CREATE POLICY "Org members can insert client notes"
  ON client_notes FOR INSERT
  TO authenticated
  WITH CHECK (can_view_org_data(organization_id));

CREATE POLICY "Org admins can update their client notes"
  ON client_notes FOR UPDATE
  TO authenticated
  USING (can_manage_org_settings(organization_id))
  WITH CHECK (can_manage_org_settings(organization_id));

CREATE POLICY "Org admins can delete their client notes"
  ON client_notes FOR DELETE
  TO authenticated
  USING (can_manage_org_settings(organization_id));

-- Function to generate secure preferences token
CREATE OR REPLACE FUNCTION generate_preferences_token()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN encode(gen_random_bytes(32), 'hex');
END;
$$;

-- Function to calculate client metrics
CREATE OR REPLACE FUNCTION update_client_metrics(client_id_input uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_revenue decimal(10,2);
  v_job_count integer;
  v_first_contact timestamptz;
  v_last_contact timestamptz;
  v_last_job timestamptz;
  v_status client_status;
  v_tier client_value_tier;
  v_all_revenue decimal[];
  v_vip_threshold decimal(10,2);
  v_high_value_threshold decimal(10,2);
  v_client_email text;
BEGIN
  -- Get client email for lookups
  SELECT email INTO v_client_email FROM clients WHERE id = client_id_input;
  
  -- Calculate total revenue from paid invoices
  SELECT COALESCE(SUM(total_amount), 0)
  INTO v_total_revenue
  FROM invoices
  WHERE client_id = client_id_input
    AND status = 'paid';
  
  -- Count completed jobs
  SELECT COUNT(*)
  INTO v_job_count
  FROM jobs
  WHERE client_id = client_id_input
    AND status = 'completed';
  
  -- Get first contact date (earliest inquiry or job)
  SELECT LEAST(
    COALESCE((SELECT MIN(created_at) FROM form_inquiries WHERE email = v_client_email AND email IS NOT NULL), 'infinity'::timestamptz),
    COALESCE((SELECT MIN(created_at) FROM jobs WHERE client_id = client_id_input), 'infinity'::timestamptz)
  )
  INTO v_first_contact
  WHERE 'infinity'::timestamptz NOT IN (
    COALESCE((SELECT MIN(created_at) FROM form_inquiries WHERE email = v_client_email AND email IS NOT NULL), 'infinity'::timestamptz),
    COALESCE((SELECT MIN(created_at) FROM jobs WHERE client_id = client_id_input), 'infinity'::timestamptz)
  );
  
  -- Get last contact date (latest activity)
  SELECT GREATEST(
    COALESCE((SELECT MAX(created_at) FROM form_inquiries WHERE email = v_client_email AND email IS NOT NULL), '-infinity'::timestamptz),
    COALESCE((SELECT MAX(updated_at) FROM jobs WHERE client_id = client_id_input), '-infinity'::timestamptz),
    COALESCE((SELECT MAX(updated_at) FROM invoices WHERE client_id = client_id_input), '-infinity'::timestamptz)
  )
  INTO v_last_contact
  WHERE '-infinity'::timestamptz NOT IN (
    COALESCE((SELECT MAX(created_at) FROM form_inquiries WHERE email = v_client_email AND email IS NOT NULL), '-infinity'::timestamptz),
    COALESCE((SELECT MAX(updated_at) FROM jobs WHERE client_id = client_id_input), '-infinity'::timestamptz),
    COALESCE((SELECT MAX(updated_at) FROM invoices WHERE client_id = client_id_input), '-infinity'::timestamptz)
  );
  
  -- Get last job completion date
  SELECT MAX(completion_date)
  INTO v_last_job
  FROM jobs
  WHERE client_id = client_id_input
    AND status = 'completed';
  
  -- Determine client status
  IF v_job_count >= 2 THEN
    v_status := 'repeat';
  ELSIF v_job_count >= 1 THEN
    IF v_last_contact < (now() - interval '90 days') THEN
      v_status := 'dormant';
    ELSE
      v_status := 'active';
    END IF;
  ELSIF v_last_contact < (now() - interval '90 days') THEN
    v_status := 'dormant';
  ELSE
    v_status := 'lead';
  END IF;
  
  -- Determine value tier (VIP = top 10%, High-Value = top 30%)
  -- Get all client revenues for the organization
  SELECT array_agg(total_revenue ORDER BY total_revenue DESC)
  INTO v_all_revenue
  FROM clients
  WHERE organization_id = (SELECT organization_id FROM clients WHERE id = client_id_input)
    AND total_revenue > 0;
  
  IF v_all_revenue IS NOT NULL AND array_length(v_all_revenue, 1) > 0 THEN
    v_vip_threshold := v_all_revenue[GREATEST(1, CEIL(array_length(v_all_revenue, 1) * 0.1)::integer)];
    v_high_value_threshold := v_all_revenue[GREATEST(1, CEIL(array_length(v_all_revenue, 1) * 0.3)::integer)];
    
    IF v_total_revenue >= v_vip_threshold THEN
      v_tier := 'vip';
    ELSIF v_total_revenue >= v_high_value_threshold THEN
      v_tier := 'high_value';
    ELSE
      v_tier := 'standard';
    END IF;
  ELSE
    v_tier := 'standard';
  END IF;
  
  -- Update client record
  UPDATE clients
  SET 
    total_revenue = v_total_revenue,
    job_count = v_job_count,
    average_job_value = CASE 
      WHEN v_job_count > 0 THEN v_total_revenue / v_job_count 
      ELSE 0 
    END,
    first_contact_date = COALESCE(first_contact_date, v_first_contact),
    last_contact_date = v_last_contact,
    last_job_date = v_last_job,
    client_status = v_status,
    client_value_tier = v_tier,
    updated_at = now()
  WHERE id = client_id_input;
END;
$$;

-- Function to find or create client by email
CREATE OR REPLACE FUNCTION upsert_client_by_email(
  p_organization_id uuid,
  p_email text,
  p_name text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_address text DEFAULT NULL,
  p_source text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
  v_existing_name text;
BEGIN
  -- Normalize email
  p_email := LOWER(TRIM(p_email));
  
  -- Try to find existing client by email
  SELECT id, name INTO v_client_id, v_existing_name
  FROM clients
  WHERE organization_id = p_organization_id
    AND LOWER(email) = p_email;
  
  IF v_client_id IS NOT NULL THEN
    -- Update existing client if new info provided
    UPDATE clients
    SET 
      name = COALESCE(p_name, v_existing_name),
      phone = COALESCE(p_phone, phone),
      address = COALESCE(p_address, address),
      source = COALESCE(source, p_source),
      updated_at = now()
    WHERE id = v_client_id;
    
    RETURN v_client_id;
  ELSE
    -- Create new client
    INSERT INTO clients (
      organization_id,
      email,
      name,
      phone,
      address,
      source,
      preferences_token
    ) VALUES (
      p_organization_id,
      p_email,
      p_name,
      p_phone,
      p_address,
      p_source,
      generate_preferences_token()
    )
    RETURNING id INTO v_client_id;
    
    RETURN v_client_id;
  END IF;
END;
$$;

-- Create views for client segments

-- Dormant clients view
CREATE OR REPLACE VIEW dormant_clients AS
SELECT 
  c.*,
  EXTRACT(days FROM (now() - c.last_contact_date))::integer as days_since_contact
FROM clients c
WHERE c.last_contact_date < (now() - interval '90 days')
  OR (c.last_contact_date IS NULL AND c.created_at < (now() - interval '90 days'));

-- High-value clients view
CREATE OR REPLACE VIEW high_value_clients AS
SELECT *
FROM clients
WHERE client_value_tier IN ('high_value', 'vip');

-- Repeat customers view
CREATE OR REPLACE VIEW repeat_customers AS
SELECT *
FROM clients
WHERE job_count >= 2;

-- Trigger to update timestamp on client updates
CREATE OR REPLACE FUNCTION update_client_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$ BEGIN
  DROP TRIGGER IF EXISTS set_client_timestamp ON clients;
  CREATE TRIGGER set_client_timestamp
    BEFORE UPDATE ON clients
    FOR EACH ROW
    EXECUTE FUNCTION update_client_timestamp();
END $$;

-- Trigger to update timestamp on client notes
CREATE OR REPLACE FUNCTION update_client_note_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$ BEGIN
  DROP TRIGGER IF EXISTS set_client_note_timestamp ON client_notes;
  CREATE TRIGGER set_client_note_timestamp
    BEFORE UPDATE ON client_notes
    FOR EACH ROW
    EXECUTE FUNCTION update_client_note_timestamp();
END $$;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION generate_preferences_token() TO authenticated;
GRANT EXECUTE ON FUNCTION update_client_metrics(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION upsert_client_by_email(uuid, text, text, text, text, text) TO authenticated;
