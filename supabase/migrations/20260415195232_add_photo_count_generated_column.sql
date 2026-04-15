/*
  # Add photo_count generated column to job_completions

  ## Summary
  Adds a stored generated column `photo_count` to `job_completions` that
  automatically computes the number of photos in the `completion_photos` array.

  ## Changes
  - `job_completions`: new column `photo_count int` (stored generated)
    - Value is always `COALESCE(array_length(completion_photos, 1), 0)`
    - Automatically kept in sync by Postgres — no triggers needed

  ## Why
  The completions list page no longer fetches the full `completion_photos` array
  (which can contain large base64 strings) to avoid unnecessary data transfer.
  Instead it selects only this lightweight integer for the photo count badge.
*/

ALTER TABLE job_completions
  ADD COLUMN IF NOT EXISTS photo_count int
    GENERATED ALWAYS AS (COALESCE(array_length(completion_photos, 1), 0)) STORED;
