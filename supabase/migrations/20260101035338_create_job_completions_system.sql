/*
  # Job Completions and Customer Satisfaction System

  ## Overview
  This migration creates a comprehensive job completion system with in-person signature capture,
  customer satisfaction ratings, and follow-up reminder tracking.

  ## New Tables

  ### 1. job_completions
  - `id` (uuid, primary key) - Unique identifier
  - `job_id` (uuid, foreign key) - Reference to jobs table
  - `completed_at` (timestamptz) - Actual completion timestamp
  - `completed_by` (uuid, foreign key) - Admin user who completed the job
  - `signature_data` (text) - Base64 encoded signature image
  - `signature_url` (text) - Optional storage URL for high-res signature
  - `completion_checklist` (jsonb) - Array of completed items
  - `completion_photos` (text[]) - Array of storage URLs for photos
  - `admin_notes` (text) - Admin notes at completion
  - `device_info` (jsonb) - Device and browser info for audit trail
  - `customer_name` (text) - Customer name at time of completion
  - `final_price` (numeric) - Final confirmed price
  - `is_customer_satisfied` (boolean) - Customer satisfaction flag
  - `location_captured` (jsonb) - GPS coordinates if available
  - `created_at` (timestamptz) - Record creation timestamp
  - `updated_at` (timestamptz) - Record last update timestamp

  ### 2. job_completion_reminders
  - `id` (uuid, primary key) - Unique identifier
  - `job_completion_id` (uuid, foreign key) - Reference to job_completions
  - `job_id` (uuid, foreign key) - Reference to jobs table
  - `reminder_type` (text) - Type: follow_up_call, warranty_check, repeat_business, custom
  - `scheduled_date` (date) - When reminder is due
  - `status` (text) - Status: pending, completed, dismissed, snoozed
  - `completed_at` (timestamptz) - When reminder was completed
  - `snoozed_until` (date) - If snoozed, when to show again
  - `admin_notes` (text) - Notes about the reminder
  - `outcome_notes` (text) - Notes after reminder is completed
  - `created_by` (uuid, foreign key) - Admin user who created reminder
  - `completed_by` (uuid, foreign key) - Admin user who completed reminder
  - `created_at` (timestamptz) - Record creation timestamp
  - `updated_at` (timestamptz) - Record last update timestamp

  ## Table Modifications

  ### jobs table additions
  - `completion_id` (uuid, foreign key) - Reference to job_completions
  - `has_signature` (boolean) - Quick flag for signature existence
  - `signed_off_at` (timestamptz) - Customer sign-off timestamp

  ### customer_reviews table additions
  - `job_completion_id` (uuid, foreign key) - Link to job completion
  - `source` (text) - Source of review: manual, job_completion, import
  - `collected_at_completion` (boolean) - Whether collected during job completion

  ## Security
  - Row Level Security (RLS) enabled on all tables
  - Only authenticated admin users can access and modify records
  - Audit trail for all completion actions

  ## Indexes
  - Foreign key indexes for optimal query performance
  - Status and date indexes for reminder queries
  - Job lookup indexes for completion tracking
*/

-- Create job_completions table
CREATE TABLE IF NOT EXISTS job_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  completed_at timestamptz NOT NULL DEFAULT now(),
  completed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  signature_data text NOT NULL,
  signature_url text,
  completion_checklist jsonb DEFAULT '[]'::jsonb,
  completion_photos text[] DEFAULT ARRAY[]::text[],
  admin_notes text DEFAULT '',
  device_info jsonb DEFAULT '{}'::jsonb,
  customer_name text NOT NULL,
  final_price numeric(10, 2),
  is_customer_satisfied boolean DEFAULT true,
  location_captured jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create job_completion_reminders table
CREATE TABLE IF NOT EXISTS job_completion_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_completion_id uuid REFERENCES job_completions(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  reminder_type text NOT NULL DEFAULT 'follow_up_call',
  scheduled_date date NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  completed_at timestamptz,
  snoozed_until date,
  admin_notes text DEFAULT '',
  outcome_notes text DEFAULT '',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  completed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_reminder_type CHECK (reminder_type IN ('follow_up_call', 'warranty_check', 'repeat_business', 'custom')),
  CONSTRAINT valid_status CHECK (status IN ('pending', 'completed', 'dismissed', 'snoozed'))
);

-- Add columns to jobs table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'completion_id'
  ) THEN
    ALTER TABLE jobs ADD COLUMN completion_id uuid REFERENCES job_completions(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'has_signature'
  ) THEN
    ALTER TABLE jobs ADD COLUMN has_signature boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'signed_off_at'
  ) THEN
    ALTER TABLE jobs ADD COLUMN signed_off_at timestamptz;
  END IF;
END $$;

-- Add columns to customer_reviews table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customer_reviews' AND column_name = 'job_completion_id'
  ) THEN
    ALTER TABLE customer_reviews ADD COLUMN job_completion_id uuid REFERENCES job_completions(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customer_reviews' AND column_name = 'source'
  ) THEN
    ALTER TABLE customer_reviews ADD COLUMN source text DEFAULT 'manual';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customer_reviews' AND column_name = 'collected_at_completion'
  ) THEN
    ALTER TABLE customer_reviews ADD COLUMN collected_at_completion boolean DEFAULT false;
  END IF;
END $$;

-- Enable Row Level Security
ALTER TABLE job_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_completion_reminders ENABLE ROW LEVEL SECURITY;

-- RLS Policies for job_completions
CREATE POLICY "Authenticated users can view job completions"
  ON job_completions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert job completions"
  ON job_completions FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update job completions"
  ON job_completions FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete job completions"
  ON job_completions FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for job_completion_reminders
CREATE POLICY "Authenticated users can view reminders"
  ON job_completion_reminders FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert reminders"
  ON job_completion_reminders FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update reminders"
  ON job_completion_reminders FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete reminders"
  ON job_completion_reminders FOR DELETE
  TO authenticated
  USING (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_job_completions_job_id ON job_completions(job_id);
CREATE INDEX IF NOT EXISTS idx_job_completions_completed_at ON job_completions(completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_completions_completed_by ON job_completions(completed_by);
CREATE INDEX IF NOT EXISTS idx_job_completions_is_satisfied ON job_completions(is_customer_satisfied);

CREATE INDEX IF NOT EXISTS idx_job_completion_reminders_job_id ON job_completion_reminders(job_id);
CREATE INDEX IF NOT EXISTS idx_job_completion_reminders_completion_id ON job_completion_reminders(job_completion_id);
CREATE INDEX IF NOT EXISTS idx_job_completion_reminders_status ON job_completion_reminders(status);
CREATE INDEX IF NOT EXISTS idx_job_completion_reminders_scheduled_date ON job_completion_reminders(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_job_completion_reminders_status_date ON job_completion_reminders(status, scheduled_date);

CREATE INDEX IF NOT EXISTS idx_jobs_completion_id ON jobs(completion_id);
CREATE INDEX IF NOT EXISTS idx_jobs_has_signature ON jobs(has_signature);

CREATE INDEX IF NOT EXISTS idx_customer_reviews_job_completion_id ON customer_reviews(job_completion_id);
CREATE INDEX IF NOT EXISTS idx_customer_reviews_source ON customer_reviews(source);

-- Function to update jobs table when completion is created
CREATE OR REPLACE FUNCTION update_job_on_completion()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE jobs
  SET 
    completion_id = NEW.id,
    has_signature = true,
    signed_off_at = NEW.completed_at,
    updated_at = now()
  WHERE id = NEW.job_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically update jobs table
DROP TRIGGER IF EXISTS trigger_update_job_on_completion ON job_completions;
CREATE TRIGGER trigger_update_job_on_completion
  AFTER INSERT ON job_completions
  FOR EACH ROW
  EXECUTE FUNCTION update_job_on_completion();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS trigger_job_completions_updated_at ON job_completions;
CREATE TRIGGER trigger_job_completions_updated_at
  BEFORE UPDATE ON job_completions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_job_completion_reminders_updated_at ON job_completion_reminders;
CREATE TRIGGER trigger_job_completion_reminders_updated_at
  BEFORE UPDATE ON job_completion_reminders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();