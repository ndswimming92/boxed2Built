/*
  # Grants: an admin-only list of grants the business could apply for

  Already applied to production on 2026-10-08 under this same version stamp.
  It is not idempotent, so do not re-run it by hand.

  1. New table
    - `business_grants` — one row per grant program. Rows are added and
      refreshed by the daily "Boxed2Built grant finder" scheduled task and shown
      under Admin > Grants. There is no draft or approval step: a saved grant
      shows in the admin portal straight away. Nothing here is ever public.
    - The unique index on (organization, funder, name) is what lets the daily
      run update a grant it has seen before instead of saving it twice. It is
      on the name rather than the link because a funder's application link
      often changes from one cycle to the next.

  2. Security
    - RLS on. Signed-in members of the organization can read.
    - `anon` has no access at all, and `authenticated` is granted SELECT only,
      so nothing in the browser can write here even if a policy were wrong.
      The grant finder writes through the database connection, not the API.
    - `apply_url` must be http(s), so a stored value can never be a
      `javascript:` link. src/utils/news.ts `safeExternalUrl` checks again
      before it is rendered.

  3. Trigger
    - `business_grants_before_update` keeps `updated_at` current.
*/

create table public.business_grants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  funder text not null check (char_length(funder) between 1 and 160),
  description text not null check (char_length(description) between 1 and 2000),
  amount text not null check (char_length(amount) between 1 and 300),
  eligibility text not null check (char_length(eligibility) between 1 and 2000),
  fit_notes text check (fit_notes is null or char_length(fit_notes) between 1 and 1500),
  application_requirements text
    check (application_requirements is null or char_length(application_requirements) between 1 and 1500),
  other_notes text check (other_notes is null or char_length(other_notes) between 1 and 2000),
  entry_fee text check (entry_fee is null or char_length(entry_fee) between 1 and 200),
  apply_url text not null check (apply_url ~* '^https?://' and char_length(apply_url) <= 2000),
  funder_scope text not null check (funder_scope in ('national', 'state', 'local', 'federal')),
  cycle_status text not null default 'open' check (cycle_status in ('open', 'upcoming', 'closed')),
  deadline date,
  deadline_note text check (deadline_note is null or char_length(deadline_note) between 1 and 200),
  opens_on date,
  last_verified_on date not null default ((now() at time zone 'America/Chicago')::date),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.business_grants is
  'Grants the business could apply for, shown under Admin > Grants. Rows are added and refreshed by the daily grant finder scheduled task. Admin-only: there is no anonymous access and nothing here is published.';
comment on column public.business_grants.funder is
  'The company or organization giving the grant.';
comment on column public.business_grants.amount is
  'The award or range exactly as the funder states it, including how many awards when stated.';
comment on column public.business_grants.eligibility is
  'Who can apply: the funder''s criteria.';
comment on column public.business_grants.fit_notes is
  'Why it fits this business, and anything the owner has to confirm himself.';
comment on column public.business_grants.entry_fee is
  'Null when applying is free. Otherwise the fee to enter, as the funder states it.';
comment on column public.business_grants.cycle_status is
  'open = accepting applications; upcoming = a real program that is between cycles or not open yet; closed = the cycle ended.';
comment on column public.business_grants.deadline_note is
  'Used when there is no exact date (Rolling, Not stated) or to add detail such as a cut-off time.';
comment on column public.business_grants.opens_on is
  'For upcoming grants: the date the funder says applications open, when stated.';
comment on column public.business_grants.last_verified_on is
  'The last day (Central time) the grant finder opened the funder''s page and confirmed these details.';

create unique index business_grants_org_funder_name_key
  on public.business_grants (organization_id, lower(funder), lower(name));

create index business_grants_org_deadline_idx
  on public.business_grants (organization_id, deadline);

create function public.business_grants_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.business_grants_before_update() from public, anon, authenticated;

create trigger business_grants_before_update
  before update on public.business_grants
  for each row execute function public.business_grants_before_update();

alter table public.business_grants enable row level security;

revoke all on public.business_grants from anon, authenticated;
grant select on public.business_grants to authenticated;

create policy "Org members can read grants"
  on public.business_grants for select to authenticated
  using (public.can_view_org_data(organization_id));
