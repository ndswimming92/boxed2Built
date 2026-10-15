/*
  # Admin changelog, readable by organization owners only

  A single row (id = 1) holds the whole changelog as JSON, written by the
  "Update changelog" GitHub workflow after every merge to main. It lives here
  rather than in the client bundle so that only a signed-in owner can read it:
  there is no anonymous access, and no insert/update/delete policy for any
  API role (the workflow writes through the management API, which bypasses RLS).
*/

create table if not exists public.site_changelog (
  id smallint primary key default 1 check (id = 1),
  generated_at date not null,
  entries jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.site_changelog enable row level security;

revoke all on public.site_changelog from anon, authenticated;
grant select on public.site_changelog to authenticated;

create policy "Owners can read the changelog"
  on public.site_changelog
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.organization_members m
      where m.user_id = (select auth.uid())
        and m.role = 'owner'
        and m.is_active
    )
  );

comment on table public.site_changelog is
  'Site change history shown under Admin > Changelog. One row, rewritten by the Update changelog workflow after each merge. Readable by organization owners only.';
