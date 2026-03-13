-- Customer portal RLS validation test cases
-- Run in a non-production environment after migrations.

-- Simulate Customer A session
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);

-- Expected: only Customer A rows
SELECT id, customer_id FROM public.jobs ORDER BY created_at DESC;
SELECT id, customer_id FROM public.invoices ORDER BY created_at DESC;
SELECT id, auth_user_id FROM public.customers;

-- Simulate Customer B session
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b2', true);

-- Expected: Customer B cannot read Customer A rows
SELECT id, customer_id FROM public.jobs WHERE customer_id = (
  SELECT id FROM public.customers WHERE auth_user_id = '00000000-0000-0000-0000-0000000000a1'::uuid
);

-- Expected: 0 rows updated (Customer B cannot update Customer A profile)
UPDATE public.customers
SET phone = '+1-555-000-1111'
WHERE auth_user_id = '00000000-0000-0000-0000-0000000000a1'::uuid;

-- Reset local auth context
SELECT set_config('request.jwt.claim.sub', '', true);
SELECT set_config('request.jwt.claim.role', '', true);
