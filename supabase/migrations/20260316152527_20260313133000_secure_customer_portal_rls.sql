/*
  # Secure customer portal RLS policies
*/

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

ALTER TABLE IF EXISTS public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.form_inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.saved_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.job_completions ENABLE ROW LEVEL SECURITY;

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

DROP POLICY IF EXISTS "Customer can view own jobs" ON public.jobs;
CREATE POLICY "Customer can view own jobs"
  ON public.jobs
  FOR SELECT
  TO authenticated
  USING (customer_id = public.current_customer_id());

DROP POLICY IF EXISTS "Customer can view own invoices" ON public.invoices;
CREATE POLICY "Customer can view own invoices"
  ON public.invoices
  FOR SELECT
  TO authenticated
  USING (customer_id = public.current_customer_id());

DROP POLICY IF EXISTS "Customer can view own form inquiries" ON public.form_inquiries;
CREATE POLICY "Customer can view own form inquiries"
  ON public.form_inquiries
  FOR SELECT
  TO authenticated
  USING (customer_id = public.current_customer_id());

DROP POLICY IF EXISTS "Customer can view own saved requests" ON public.saved_requests;
CREATE POLICY "Customer can view own saved requests"
  ON public.saved_requests
  FOR SELECT
  TO authenticated
  USING (customer_id = public.current_customer_id());

DROP POLICY IF EXISTS "Customer can view own job completions" ON public.job_completions;
CREATE POLICY "Customer can view own job completions"
  ON public.job_completions
  FOR SELECT
  TO authenticated
  USING (customer_id = public.current_customer_id());
