/*
  # Secure customer portal RLS policies

  ## Goals
  1) Ensure RLS is enabled for all customer-facing portal tables.
  2) Scope SELECT access to authenticated user's customer mapping.
  3) Allow UPDATE only for customer profile records (public.customers).
  4) Remove broad authenticated USING (true) policies from portal tables.
*/

-- 1) Helper to resolve the authenticated user's customer mapping
CREATE OR REPLACE FUNCTION public.current_customer_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id
  FROM public.customers c
  WHERE c.auth_user_id = auth.uid()
  ORDER BY c.created_at ASC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.current_customer_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_customer_id() TO authenticated;

-- 2) Ensure RLS is enabled on customer-facing tables
ALTER TABLE IF EXISTS public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.form_inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.saved_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.job_completions ENABLE ROW LEVEL SECURITY;

-- 3) Remove broad authenticated USING (true) policies for portal tables
DO $$
DECLARE
  p record;
BEGIN
  FOR p IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('customers', 'jobs', 'invoices', 'form_inquiries', 'saved_requests', 'job_completions')
      AND roles @> ARRAY['authenticated']::name[]
      AND (
        COALESCE(qual, '') IN ('true', '(true)')
        OR COALESCE(with_check, '') IN ('true', '(true)')
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', p.policyname, p.schemaname, p.tablename);
  END LOOP;
END $$;

-- 4) Replace with customer-scoped portal policies
-- customers (profile)
DROP POLICY IF EXISTS "Customer can view own profile" ON public.customers;
CREATE POLICY "Customer can view own profile"
  ON public.customers
  FOR SELECT
  TO authenticated
  USING (id = public.current_customer_id());

DROP POLICY IF EXISTS "Customer can update own profile" ON public.customers;
CREATE POLICY "Customer can update own profile"
  ON public.customers
  FOR UPDATE
  TO authenticated
  USING (id = public.current_customer_id())
  WITH CHECK (id = public.current_customer_id());

-- jobs
DROP POLICY IF EXISTS "Customer can view own jobs" ON public.jobs;
CREATE POLICY "Customer can view own jobs"
  ON public.jobs
  FOR SELECT
  TO authenticated
  USING (customer_id = public.current_customer_id());

-- invoices
DROP POLICY IF EXISTS "Customer can view own invoices" ON public.invoices;
CREATE POLICY "Customer can view own invoices"
  ON public.invoices
  FOR SELECT
  TO authenticated
  USING (customer_id = public.current_customer_id());

-- form_inquiries
DROP POLICY IF EXISTS "Customer can view own form inquiries" ON public.form_inquiries;
CREATE POLICY "Customer can view own form inquiries"
  ON public.form_inquiries
  FOR SELECT
  TO authenticated
  USING (customer_id = public.current_customer_id());

-- saved_requests
DROP POLICY IF EXISTS "Customer can view own saved requests" ON public.saved_requests;
CREATE POLICY "Customer can view own saved requests"
  ON public.saved_requests
  FOR SELECT
  TO authenticated
  USING (customer_id = public.current_customer_id());

-- job_completions
DROP POLICY IF EXISTS "Customer can view own job completions" ON public.job_completions;
CREATE POLICY "Customer can view own job completions"
  ON public.job_completions
  FOR SELECT
  TO authenticated
  USING (customer_id = public.current_customer_id());
