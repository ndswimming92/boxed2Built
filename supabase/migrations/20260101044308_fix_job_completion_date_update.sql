/*
  # Fix Job Completion Date Update

  ## Problem
  When jobs are completed through the completion wizard, the `date_completed` field
  was not being set. This caused analytics to show 0 jobs for time periods that
  should include recently completed jobs.

  ## Changes
  Update the `update_job_on_completion()` trigger function to set the `date_completed`
  field when a job completion is recorded. This ensures analytics correctly count
  completed jobs in their time period filters.

  ## Security
  No security changes - only modifying existing trigger function
*/

-- Update the trigger function to set date_completed
CREATE OR REPLACE FUNCTION update_job_on_completion()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE jobs
  SET 
    completion_id = NEW.id,
    has_signature = true,
    signed_off_at = NEW.completed_at,
    date_completed = DATE(NEW.completed_at),
    updated_at = now()
  WHERE id = NEW.job_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;