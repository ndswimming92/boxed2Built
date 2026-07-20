/*
  # Create Contractors System

  1. New Tables
    - `contractors` - a reusable directory of subcontractors / helpers
      - `id` (uuid, primary key)
      - `business_id` (uuid, references business_info)
      - `organization_id` (uuid, references organizations)
      - `name` (text, required) - Contractor's name
      - `phone` (text) - Contact phone
      - `email` (text) - Contact email
      - `notes` (text) - Free-form notes (specialties, rates, etc.)
      - `is_active` (boolean, default true) - Soft delete flag
      - `created_at` / `updated_at` (timestamptz)

    - `job_contractors` - links a contractor to a specific job with the amount paid
      - `id` (uuid, primary key)
      - `business_id` (uuid, references business_info)
      - `organization_id` (uuid, references organizations)
      - `job_id` (uuid, references jobs, cascade delete)
      - `contractor_id` (uuid, references contractors)
      - `amount_paid` (numeric) - Money paid to the contractor out of this job's revenue
      - `work_description` (text) - What the contractor did on the job
      - `payment_date` (date) - When the contractor was paid
      - `payment_method` (text) - How the contractor was paid
      - `notes` (text) - Additional notes
      - `is_active` (boolean, default true) - Soft delete flag
      - `created_at` / `updated_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Policies mirror the operational-table convention:
      - Platform admins have full access
      - Organization members can view their data
      - Organization members (member+) can manage data

  3. Notes
    - `amount_paid` is a cost against the job's revenue and reduces net profit.
    - Deleting a job cascades to its `job_contractors` rows.
    - Deactivating a contractor is a soft delete; historical `job_contractors`
      rows keep pointing at the contractor record for reporting.
    - `organization_id` gets a default of the Boxed2Built org so inserts that
      omit it do not fail (matches every other operational table).
*/

-- ── contractors ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contractors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES business_info(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES organizations(id),
  name text NOT NULL,
  phone text,
  email text,
  notes text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ── job_contractors ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS job_contractors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES business_info(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES organizations(id),
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  contractor_id uuid NOT NULL REFERENCES contractors(id) ON DELETE CASCADE,
  amount_paid numeric(10, 2) NOT NULL DEFAULT 0,
  work_description text,
  payment_date date,
  payment_method text,
  notes text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ── Default organization_id (fallback so inserts that omit it don't fail) ─────
DO $$
DECLARE
  v_org_id uuid;
BEGIN
  SELECT id INTO v_org_id FROM organizations WHERE slug = 'boxed2built' LIMIT 1;
  IF v_org_id IS NULL THEN
    SELECT id INTO v_org_id FROM organizations LIMIT 1;
  END IF;

  IF v_org_id IS NOT NULL THEN
    EXECUTE format('ALTER TABLE contractors ALTER COLUMN organization_id SET DEFAULT %L', v_org_id);
    EXECUTE format('ALTER TABLE job_contractors ALTER COLUMN organization_id SET DEFAULT %L', v_org_id);
  END IF;
END $$;

-- ── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_contractors_business_id ON contractors(business_id);
CREATE INDEX IF NOT EXISTS idx_contractors_organization_id ON contractors(organization_id);
CREATE INDEX IF NOT EXISTS idx_job_contractors_business_id ON job_contractors(business_id);
CREATE INDEX IF NOT EXISTS idx_job_contractors_organization_id ON job_contractors(organization_id);
CREATE INDEX IF NOT EXISTS idx_job_contractors_job_id ON job_contractors(job_id);
CREATE INDEX IF NOT EXISTS idx_job_contractors_contractor_id ON job_contractors(contractor_id);

-- ── updated_at triggers ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_contractors_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS contractors_updated_at ON contractors;
CREATE TRIGGER contractors_updated_at
  BEFORE UPDATE ON contractors
  FOR EACH ROW
  EXECUTE FUNCTION update_contractors_updated_at();

DROP TRIGGER IF EXISTS job_contractors_updated_at ON job_contractors;
CREATE TRIGGER job_contractors_updated_at
  BEFORE UPDATE ON job_contractors
  FOR EACH ROW
  EXECUTE FUNCTION update_contractors_updated_at();

-- ── RLS: contractors ─────────────────────────────────────────────────────────
ALTER TABLE contractors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins have full access to contractors"
  ON contractors FOR ALL
  TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

CREATE POLICY "Organization members can view their contractors"
  ON contractors FOR SELECT
  TO authenticated
  USING (can_view_org_data(organization_id));

CREATE POLICY "Organization members can manage contractors"
  ON contractors FOR ALL
  TO authenticated
  USING (has_org_permission(organization_id, 'member'))
  WITH CHECK (has_org_permission(organization_id, 'member'));

-- ── RLS: job_contractors ─────────────────────────────────────────────────────
ALTER TABLE job_contractors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins have full access to job_contractors"
  ON job_contractors FOR ALL
  TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

CREATE POLICY "Organization members can view their job_contractors"
  ON job_contractors FOR SELECT
  TO authenticated
  USING (can_view_org_data(organization_id));

CREATE POLICY "Organization members can manage job_contractors"
  ON job_contractors FOR ALL
  TO authenticated
  USING (has_org_permission(organization_id, 'member'))
  WITH CHECK (has_org_permission(organization_id, 'member'));
