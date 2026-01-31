/*
  # Add Job Lifecycle Status Tracking

  1. Changes to Jobs Table
    - Add `job_status` column (text with check constraint for: 'quoted', 'accepted', 'scheduled', 'in_progress', 'completed', 'lost', 'cancelled')
    - Add `lost_reason_category` column (text with predefined categories)
    - Add `lost_reason_notes` column (text, nullable for detailed explanation)
    - Add `status_changed_at` column (timestamptz for tracking when status changed)
    - Add `status_changed_by` column (text, nullable for tracking who changed it)
    - Set default status to 'quoted' for new jobs
    - Backfill existing jobs with appropriate statuses

  2. Indexes
    - Create index on `job_status` for efficient filtering
    - Create composite index on (business_id, job_status, status_changed_at) for analytics
    - Create index on (job_status, lost_reason_category) for lost deals analysis
    - Create index on `status_changed_at` for temporal queries

  3. Security
    - All RLS policies inherit from existing jobs table policies
    - No changes needed to RLS as these are just additional columns

  4. Lost Reason Categories
    - Price too high
    - Went with competitor
    - Customer decided not to proceed
    - Timeline didn't work
    - Customer unresponsive
    - Out of service area
    - Project scope mismatch
    - Other
*/

-- Add job status columns to jobs table
DO $$
BEGIN
  -- Add job_status column with check constraint
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'job_status'
  ) THEN
    ALTER TABLE jobs ADD COLUMN job_status text DEFAULT 'quoted'
      CHECK (job_status IN ('quoted', 'accepted', 'scheduled', 'in_progress', 'completed', 'lost', 'cancelled'));
  END IF;

  -- Add lost_reason_category column with check constraint
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'lost_reason_category'
  ) THEN
    ALTER TABLE jobs ADD COLUMN lost_reason_category text
      CHECK (lost_reason_category IN (
        'Price too high',
        'Went with competitor',
        'Customer decided not to proceed',
        'Timeline didn''t work',
        'Customer unresponsive',
        'Out of service area',
        'Project scope mismatch',
        'Other'
      ));
  END IF;

  -- Add lost_reason_notes column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'lost_reason_notes'
  ) THEN
    ALTER TABLE jobs ADD COLUMN lost_reason_notes text;
  END IF;

  -- Add status_changed_at column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'status_changed_at'
  ) THEN
    ALTER TABLE jobs ADD COLUMN status_changed_at timestamptz DEFAULT now();
  END IF;

  -- Add status_changed_by column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'status_changed_by'
  ) THEN
    ALTER TABLE jobs ADD COLUMN status_changed_by text;
  END IF;
END $$;

-- Backfill existing jobs with appropriate statuses based on their current state
UPDATE jobs
SET 
  job_status = CASE
    WHEN date_completed IS NOT NULL THEN 'completed'
    WHEN date_scheduled IS NOT NULL AND date_scheduled <= CURRENT_DATE THEN 'in_progress'
    WHEN date_scheduled IS NOT NULL THEN 'scheduled'
    WHEN date_quoted IS NOT NULL THEN 'quoted'
    ELSE 'quoted'
  END,
  status_changed_at = COALESCE(date_completed::timestamptz, date_scheduled::timestamptz, date_quoted::timestamptz, created_at)
WHERE job_status IS NULL OR job_status = 'quoted';

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(job_status);
CREATE INDEX IF NOT EXISTS idx_jobs_status_composite ON jobs(business_id, job_status, status_changed_at);
CREATE INDEX IF NOT EXISTS idx_jobs_lost_reason ON jobs(job_status, lost_reason_category) WHERE job_status = 'lost';
CREATE INDEX IF NOT EXISTS idx_jobs_status_changed_at ON jobs(status_changed_at);

-- Create trigger to automatically update status_changed_at when job_status changes
CREATE OR REPLACE FUNCTION update_job_status_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.job_status IS DISTINCT FROM NEW.job_status THEN
    NEW.status_changed_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_job_status_timestamp ON jobs;
CREATE TRIGGER trigger_update_job_status_timestamp
  BEFORE UPDATE ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_job_status_timestamp();