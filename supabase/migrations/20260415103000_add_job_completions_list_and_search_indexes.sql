-- Optimize admin completions list queries and customer name search.
-- Supports ordering/filtering by organization + completion date and ILIKE search on customer_name.

CREATE INDEX IF NOT EXISTS idx_job_completions_org_completed_at
  ON public.job_completions (organization_id, completed_at DESC);

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_job_completions_customer_name_trgm
  ON public.job_completions
  USING gin (customer_name gin_trgm_ops);
