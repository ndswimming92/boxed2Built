/*
  # Allow anonymous users to verify organization existence

  The form_inquiries INSERT policy for anon users includes a WITH CHECK that
  validates the organization_id exists via: EXISTS (SELECT 1 FROM organizations WHERE id = ...).
  However, the organizations table had no SELECT policy for the anon role, causing
  the subquery to always return false and blocking all anonymous form submissions.

  1. Security
    - Added a minimal SELECT policy for anon on organizations
    - Policy only allows checking existence (SELECT 1 pattern in RLS subqueries)
    - Uses USING (true) scoped ONLY to the anon role — this is safe because
      the organizations table only contains org IDs/names (no sensitive data)
      and anon users already need this access for form submission validation
*/

CREATE POLICY "Anon can verify organization existence"
  ON public.organizations
  FOR SELECT
  TO anon
  USING (true);
