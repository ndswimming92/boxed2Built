/*
  # Grants: readable by the organization's owners and admins only

  Already applied to production on 2026-10-08 under this same version stamp.

  The first policy used `can_view_org_data`, which is true for any active
  member, including the `viewer` and `member` roles. The admin route guard only
  protects the page, not the REST endpoint, so a lower role could have read the
  table directly. The list is meant for whoever runs the business.

  `can_manage_org_settings` is true for the `admin` and `owner` roles, and for
  platform admins, which is the same rule that guards writes to `news_items`.

  The policy is altered in place rather than dropped and recreated, so there is
  never a moment with no policy on the table.
*/

alter policy "Org members can read grants" on public.business_grants
  rename to "Org admins can read grants";

alter policy "Org admins can read grants" on public.business_grants
  using (public.can_manage_org_settings(organization_id));

comment on table public.business_grants is
  'Grants the business could apply for, shown under Admin > Grants. Rows are added and refreshed by the daily grant finder scheduled task. Readable by the organization''s owners and admins only: there is no anonymous access and nothing here is published.';
