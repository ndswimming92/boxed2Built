/*
  # Mark jobs completed when a completion is recorded

  ## Problem
  Finishing the job completion wizard inserted a `job_completions` row and set
  `jobs.date_completed`, but left `jobs.job_status` alone. A signed-off job kept
  showing as scheduled/in progress until someone reopened it and changed the
  status by hand. The trigger had also stopped setting `completion_id`,
  `has_signature` and `signed_off_at`, so the "Complete Job" button stayed on
  jobs that were already completed and they could be completed twice.

  ## Changes
  - `update_job_on_completion()` now sets `job_status = 'completed'`,
    `has_signature` and `signed_off_at` alongside the existing `completion_id`
    and `date_completed` writes. Updates stay idempotent.
  - Backfill 1 links existing jobs to their completion record and restores the
    signature flags, so the button stops offering to re-complete them.
  - Backfill 2 closes out jobs that were signed off but never moved past an
    open status. Lost and cancelled jobs are left as they are.

  Both backfills stay clear of `jobs_completed_hours_worked_required`, which
  rejects a completed job (or one carrying a completion date) without positive
  `hours_worked`.

  ## Security
  No security changes - the function keeps SECURITY DEFINER, its pinned
  search_path, and (via CREATE OR REPLACE) its existing EXECUTE grants.
*/

CREATE OR REPLACE FUNCTION public.update_job_on_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.jobs
    SET
      completion_id = NEW.id,
      date_completed = DATE(NEW.completed_at),
      job_status = 'completed',
      has_signature = true,
      signed_off_at = NEW.completed_at,
      updated_at = now()
    WHERE id = NEW.job_id
      AND (
        completion_id IS DISTINCT FROM NEW.id
        OR date_completed IS DISTINCT FROM DATE(NEW.completed_at)
        OR job_status IS DISTINCT FROM 'completed'
        OR has_signature IS DISTINCT FROM true
        OR signed_off_at IS DISTINCT FROM NEW.completed_at
      );
  END IF;

  RETURN NEW;
END;
$$;

-- Backfill 1: link jobs to their completion record and restore the signature
-- flags. Skips rows that already violate the hours constraint, since any write
-- to those would be rejected.
WITH latest_completion AS (
  SELECT DISTINCT ON (job_id) job_id, id, completed_at
  FROM public.job_completions
  ORDER BY job_id, completed_at DESC
)
UPDATE public.jobs j
SET
  completion_id = COALESCE(j.completion_id, c.id),
  has_signature = true,
  signed_off_at = COALESCE(j.signed_off_at, c.completed_at),
  updated_at = now()
FROM latest_completion c
WHERE c.job_id = j.id
  AND (
    j.completion_id IS NULL
    OR j.has_signature IS DISTINCT FROM true
    OR j.signed_off_at IS NULL
  )
  AND (
    j.hours_worked > 0
    OR (j.job_status <> 'completed' AND j.date_completed IS NULL)
  );

-- Backfill 2: close out jobs signed off through the wizard that never reached
-- 'completed'.
WITH latest_completion AS (
  SELECT DISTINCT ON (job_id) job_id, id, completed_at
  FROM public.job_completions
  ORDER BY job_id, completed_at DESC
)
UPDATE public.jobs j
SET
  job_status = 'completed',
  date_completed = COALESCE(j.date_completed, DATE(c.completed_at)),
  updated_at = now()
FROM latest_completion c
WHERE c.job_id = j.id
  AND j.job_status IN ('quoted', 'accepted', 'scheduled', 'in_progress')
  AND j.hours_worked IS NOT NULL
  AND j.hours_worked > 0;
