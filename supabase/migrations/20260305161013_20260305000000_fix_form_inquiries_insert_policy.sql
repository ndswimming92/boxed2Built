/*
  # Fix form_inquiries INSERT policy

  ## Problem
  The "Anyone can submit form inquiries" INSERT policy has a WITH CHECK that requires
  business_id IS NOT NULL AND client_name IS NOT NULL AND client_name <> ''.
  This blocks anonymous public form submissions that don't include a business_id.

  ## Fix
  Replace the restrictive WITH CHECK with WITH CHECK (true) so any visitor can
  submit the contact form. Data validation is handled at the application layer.
*/

DROP POLICY IF EXISTS "Anyone can submit form inquiries" ON public.form_inquiries;

CREATE POLICY "Anyone can submit form inquiries"
  ON public.form_inquiries
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);
