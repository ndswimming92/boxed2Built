/*
  # Fix public inquiry submission RLS

  Ensures website visitors can submit contact form inquiries even when
  an authenticated session exists in the browser.

  Why:
  - Some environments still have legacy insert policies that only allow
    authenticated users with `auth.uid()`.
  - Public form submissions use the anon key and should always be allowed.

  This migration is idempotent and safe to run repeatedly.
*/

-- Remove legacy/conflicting insert policies on form_inquiries
DROP POLICY IF EXISTS "Authenticated users can insert inquiries" ON public.form_inquiries;
DROP POLICY IF EXISTS "Anonymous users can submit inquiries" ON public.form_inquiries;
DROP POLICY IF EXISTS "Anyone can submit form inquiries" ON public.form_inquiries;

-- Ensure public website submissions are allowed
CREATE POLICY "Anyone can submit form inquiries"
  ON public.form_inquiries
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Keep auth-only read/update/delete scoped by organization (if they already exist)
-- This migration intentionally only normalizes INSERT behavior.
