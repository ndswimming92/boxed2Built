/*
  # Create Mileage Tracking System

  ## Overview
  Implements a comprehensive GPS-based mileage tracking system for jobs with automatic tax deduction calculations.

  ## New Tables

  ### `mileage_records`
  - `id` (uuid, primary key) - Unique identifier for the mileage record
  - `business_id` (uuid, foreign key) - Links to business_info table
  - `job_id` (uuid, foreign key) - Links to jobs table
  - `trip_date` (date) - Date of the trip
  - `start_time` (timestamptz) - When tracking started
  - `end_time` (timestamptz) - When tracking ended
  - `start_location` (jsonb) - Starting GPS coordinates {lat, lng, address}
  - `end_location` (jsonb) - Ending GPS coordinates {lat, lng, address}
  - `waypoints` (jsonb) - Array of GPS waypoints tracked during trip
  - `distance_miles` (numeric) - Total distance in miles
  - `is_manual_entry` (boolean) - Whether distance was manually entered or GPS tracked
  - `purpose` (text) - Trip purpose/description
  - `irs_rate_per_mile` (numeric) - IRS mileage rate at time of trip
  - `deduction_amount` (numeric) - Calculated tax deduction (distance * rate)
  - `expense_id` (uuid) - Links to generated expense record if applicable
  - `notes` (text) - Additional notes about the trip
  - `is_active` (boolean) - Soft delete flag
  - `created_at` (timestamptz) - Record creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ## Table Modifications

  ### `jobs` table
  - Add `total_mileage` (numeric) - Cached total mileage for the job
  - Add `mileage_deduction` (numeric) - Cached total mileage deduction amount

  ## Security
  - Enable RLS on mileage_records table
  - Add policies for authenticated admin users to manage mileage records
  - Add indexes for efficient querying by job, date, and business

  ## Functions
  - Create trigger to update job mileage totals when records change
  - Create trigger to auto-update deduction amounts
*/

-- Create mileage_records table
CREATE TABLE IF NOT EXISTS mileage_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES business_info(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  trip_date date NOT NULL DEFAULT CURRENT_DATE,
  start_time timestamptz NOT NULL,
  end_time timestamptz,
  start_location jsonb,
  end_location jsonb,
  waypoints jsonb DEFAULT '[]'::jsonb,
  distance_miles numeric(10, 2) NOT NULL DEFAULT 0,
  is_manual_entry boolean DEFAULT false,
  purpose text,
  irs_rate_per_mile numeric(6, 3) NOT NULL DEFAULT 0.67,
  deduction_amount numeric(10, 2) GENERATED ALWAYS AS (distance_miles * irs_rate_per_mile) STORED,
  expense_id uuid REFERENCES business_expenses(id) ON DELETE SET NULL,
  notes text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add mileage fields to jobs table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'total_mileage'
  ) THEN
    ALTER TABLE jobs ADD COLUMN total_mileage numeric(10, 2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'mileage_deduction'
  ) THEN
    ALTER TABLE jobs ADD COLUMN mileage_deduction numeric(10, 2) DEFAULT 0;
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_mileage_records_business_id ON mileage_records(business_id);
CREATE INDEX IF NOT EXISTS idx_mileage_records_job_id ON mileage_records(job_id);
CREATE INDEX IF NOT EXISTS idx_mileage_records_trip_date ON mileage_records(trip_date);
CREATE INDEX IF NOT EXISTS idx_mileage_records_business_trip_date ON mileage_records(business_id, trip_date);
CREATE INDEX IF NOT EXISTS idx_mileage_records_job_active ON mileage_records(job_id, is_active);

-- Enable Row Level Security
ALTER TABLE mileage_records ENABLE ROW LEVEL SECURITY;

-- RLS Policies for mileage_records
CREATE POLICY "Authenticated users can view mileage records"
  ON mileage_records FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create mileage records"
  ON mileage_records FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update mileage records"
  ON mileage_records FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete mileage records"
  ON mileage_records FOR DELETE
  TO authenticated
  USING (true);

-- Function to update job mileage totals
CREATE OR REPLACE FUNCTION update_job_mileage_totals()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the job's mileage totals
  UPDATE jobs
  SET 
    total_mileage = COALESCE((
      SELECT SUM(distance_miles)
      FROM mileage_records
      WHERE job_id = COALESCE(NEW.job_id, OLD.job_id)
        AND is_active = true
    ), 0),
    mileage_deduction = COALESCE((
      SELECT SUM(deduction_amount)
      FROM mileage_records
      WHERE job_id = COALESCE(NEW.job_id, OLD.job_id)
        AND is_active = true
    ), 0),
    updated_at = now()
  WHERE id = COALESCE(NEW.job_id, OLD.job_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update job mileage on record changes
DROP TRIGGER IF EXISTS trigger_update_job_mileage ON mileage_records;
CREATE TRIGGER trigger_update_job_mileage
  AFTER INSERT OR UPDATE OR DELETE ON mileage_records
  FOR EACH ROW
  EXECUTE FUNCTION update_job_mileage_totals();

-- Function to set updated_at timestamp
CREATE OR REPLACE FUNCTION update_mileage_records_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS trigger_mileage_records_updated_at ON mileage_records;
CREATE TRIGGER trigger_mileage_records_updated_at
  BEFORE UPDATE ON mileage_records
  FOR EACH ROW
  EXECUTE FUNCTION update_mileage_records_updated_at();

-- Create mileage settings table for configurable IRS rates
CREATE TABLE IF NOT EXISTS mileage_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES business_info(id) ON DELETE CASCADE,
  effective_date date NOT NULL,
  rate_per_mile numeric(6, 3) NOT NULL,
  notes text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(business_id, effective_date)
);

-- Create index for mileage settings
CREATE INDEX IF NOT EXISTS idx_mileage_settings_business_date ON mileage_settings(business_id, effective_date DESC);

-- Enable RLS on mileage_settings
ALTER TABLE mileage_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for mileage_settings
CREATE POLICY "Authenticated users can view mileage settings"
  ON mileage_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage mileage settings"
  ON mileage_settings FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Function to get current IRS mileage rate
CREATE OR REPLACE FUNCTION get_current_mileage_rate(p_business_id uuid, p_date date DEFAULT CURRENT_DATE)
RETURNS numeric AS $$
DECLARE
  v_rate numeric;
BEGIN
  SELECT rate_per_mile INTO v_rate
  FROM mileage_settings
  WHERE business_id = p_business_id
    AND effective_date <= p_date
    AND is_active = true
  ORDER BY effective_date DESC
  LIMIT 1;
  
  -- Return default 2024 IRS rate if no custom rate found
  RETURN COALESCE(v_rate, 0.67);
END;
$$ LANGUAGE plpgsql;

-- Insert default IRS rate for 2024
INSERT INTO mileage_settings (business_id, effective_date, rate_per_mile, notes)
SELECT 
  id,
  '2024-01-01'::date,
  0.67,
  '2024 IRS Standard Mileage Rate'
FROM business_info
WHERE is_active = true
ON CONFLICT (business_id, effective_date) DO NOTHING;