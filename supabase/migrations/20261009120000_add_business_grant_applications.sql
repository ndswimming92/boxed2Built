/*
  # Grants: track which grants the business has applied for

  1. New columns on `business_grants`
    - `applied_on` — the day the business applied (null = not applied). A grant
      with this set shows on the Applied tab instead of Open / Closed.
    - `applied_by` — who marked it applied. Set by a trigger from the signed-in
      user, never taken from the browser.
    - `application_outcome` — pending, awarded or not_selected.
    - `application_notes` — free text: confirmation numbers, contacts.

  2. Security
    - The browser could only SELECT. It is now also granted UPDATE on the
      `applied_on`, `application_outcome` and `application_notes` columns and
      nothing else, so it still cannot change what the grant finder wrote.
    - The update policy is the same rule as the read policy: owners and admins.
    - The grant finder's daily upsert does not touch these columns, so a
      refresh never clears an application.
*/

alter table public.business_grants
  add column applied_on date,
  add column applied_by uuid references auth.users(id) on delete set null,
  add column application_outcome text not null default 'pending'
    check (application_outcome in ('pending', 'awarded', 'not_selected')),
  add column application_notes text
    check (application_notes is null or char_length(application_notes) <= 2000);

comment on column public.business_grants.applied_on is
  'The day the business applied for this grant. Null when it has not applied.';
comment on column public.business_grants.applied_by is
  'The admin who marked the grant applied. Set by trigger from auth.uid().';

create function public.business_grants_set_applied_by()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.applied_on is null then
    new.applied_by := null;
    new.application_outcome := 'pending';
    new.application_notes := null;
  elsif old.applied_on is null then
    new.applied_by := auth.uid();
  else
    new.applied_by := old.applied_by;
  end if;
  return new;
end;
$$;

revoke all on function public.business_grants_set_applied_by() from public, anon, authenticated;

create trigger business_grants_set_applied_by
  before update on public.business_grants
  for each row
  when (
    old.applied_on is distinct from new.applied_on
    or old.applied_by is distinct from new.applied_by
  )
  execute function public.business_grants_set_applied_by();

grant update (applied_on, application_outcome, application_notes)
  on public.business_grants to authenticated;

create policy "Org admins can track applications"
  on public.business_grants for update to authenticated
  using (public.can_manage_org_settings(organization_id))
  with check (public.can_manage_org_settings(organization_id));
