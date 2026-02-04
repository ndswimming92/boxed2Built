/*
  # Fix job status trigger to handle client_id updates

  ## Overview
  Updates the job status timestamp trigger to only fire when the status
  field actually changes, not when other fields like client_id are updated.

  ## Changes
  - Recreates trigger to fire only on status column changes
*/

-- Drop existing trigger
DROP TRIGGER IF EXISTS trigger_update_job_status_timestamp ON jobs;

-- Recreate trigger to only fire on status changes
CREATE TRIGGER trigger_update_job_status_timestamp
  BEFORE UPDATE OF job_status ON jobs
  FOR EACH ROW
  WHEN (NEW.job_status IS DISTINCT FROM OLD.job_status)
  EXECUTE FUNCTION update_job_status_timestamp();
