/*
  # Competitor Watch: who Boxed2Built competes with, and what to do about it

  Already applied to production on 2026-10-09 under this same version stamp.
  It is not idempotent, so do not re-run it by hand.

  1. New tables
    - `competitors` — one row per competing business: a local assembly
      business, a national platform, a retailer's own assembly service, or a
      standout business elsewhere that is worth learning from. Each row carries
      whatever could be found about it: website, owner, email, phone, services,
      pricing, how customers book, what stands out and its reviews.
    - `competitor_action_items` — the checklist: one row per thing competitors
      are doing that Boxed2Built is not doing yet.
    Both are filled by the weekly "Boxed2Built competitor watch" scheduled task
    and shown together under Admin > Competitor Watch. Nothing here is public.

  2. What the browser may change
    - On an action item, only `status`: open, done (checked off) or dismissed
      (removed as not relevant). A dismissed row is kept, not deleted, because
      the weekly run reads it to know not to suggest the same thing again.
    - On a competitor, only `removed_at`: set when the owner says the business
      is not a competitor. Kept for the same reason.
    - Everything else is written by the weekly run through the database
      connection, never from the browser. The weekly run's upsert leaves
      `status` and `removed_at` alone, so a refresh never undoes a tick.

  3. Security
    - RLS on. Owners and admins only (`can_manage_org_settings`), for reads and
      for the two updates above. `anon` has no access at all.
    - `authenticated` is granted SELECT plus UPDATE on the one column per table,
      so nothing in the browser can rewrite what the weekly run saved even if a
      policy were wrong.
    - Who ticked or removed something, and when, is set by trigger from the
      signed-in user and the server clock, never taken from the browser.
    - Web addresses must be http(s), so a stored value can never be a
      `javascript:` link. src/utils/news.ts `safeExternalUrl` checks again
      before one is rendered.
*/

create table public.competitors (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 160),
  category text not null check (category in ('local', 'platform', 'retailer', 'out_of_area')),
  operating_status text not null default 'operating' check (operating_status in ('operating', 'closed')),
  location text check (location is null or char_length(location) between 1 and 200),
  summary text not null check (char_length(summary) between 1 and 600),
  website_url text check (website_url is null or (website_url ~* '^https?://' and char_length(website_url) <= 2000)),
  owner_name text check (owner_name is null or char_length(owner_name) between 1 and 200),
  email text check (email is null or (email ~ '^[^@[:space:]]+@[^@[:space:]]+$' and char_length(email) <= 320)),
  phone text check (phone is null or char_length(phone) between 1 and 60),
  service_area text check (service_area is null or char_length(service_area) between 1 and 600),
  services text check (services is null or char_length(services) between 1 and 2000),
  pricing text check (pricing is null or char_length(pricing) between 1 and 2000),
  booking text check (booking is null or char_length(booking) between 1 and 1500),
  standout text check (standout is null or char_length(standout) between 1 and 2000),
  reviews text check (reviews is null or char_length(reviews) between 1 and 1000),
  other_notes text check (other_notes is null or char_length(other_notes) between 1 and 2000),
  links jsonb not null default '[]'::jsonb
    check (jsonb_typeof(links) = 'array' and jsonb_array_length(links) <= 12),
  last_verified_on date not null default ((now() at time zone 'America/Chicago')::date),
  removed_at timestamptz,
  removed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.competitors is
  'Businesses Boxed2Built competes with or can learn from, shown under Admin > Competitor Watch. Rows are added and refreshed by the weekly competitor watch scheduled task. Readable by the organization''s owners and admins only: there is no anonymous access and nothing here is published.';
comment on column public.competitors.category is
  'local = an assembly business serving the same area; platform = a national marketplace or app; retailer = a store''s own assembly service; out_of_area = a standout business elsewhere, kept for ideas.';
comment on column public.competitors.owner_name is
  'The owner or founder, only as the business itself or a public business listing names them.';
comment on column public.competitors.email is
  'The business''s published contact email. Never a personal address found elsewhere.';
comment on column public.competitors.links is
  'Other public pages for the business, as [{"label": "Facebook", "url": "https://..."}].';
comment on column public.competitors.last_verified_on is
  'The last day (Central time) the weekly run opened this business''s own pages and confirmed these details.';
comment on column public.competitors.removed_at is
  'Set when the owner says this is not a competitor. The row is kept so the weekly run does not add it again.';

create unique index competitors_org_name_key
  on public.competitors (organization_id, lower(name));

create table public.competitor_action_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  detail text not null check (char_length(detail) between 1 and 800),
  suggestion text check (suggestion is null or char_length(suggestion) between 1 and 800),
  category text not null
    check (category in ('services', 'pricing', 'booking', 'marketing', 'trust', 'customer_experience', 'other')),
  priority text not null default 'medium' check (priority in ('high', 'medium', 'low')),
  effort text not null default 'moderate' check (effort in ('quick', 'moderate', 'big')),
  competitor_names text[] not null default '{}'::text[]
    check (cardinality(competitor_names) <= 12),
  source_url text check (source_url is null or (source_url ~* '^https?://' and char_length(source_url) <= 2000)),
  status text not null default 'open' check (status in ('open', 'done', 'dismissed')),
  status_changed_at timestamptz,
  status_changed_by uuid references auth.users(id) on delete set null,
  last_seen_on date not null default ((now() at time zone 'America/Chicago')::date),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.competitor_action_items is
  'The Competitor Watch checklist: things competitors do that Boxed2Built does not do yet. Rows are added by the weekly competitor watch scheduled task; the owner ticks them off or removes them. Readable by the organization''s owners and admins only.';
comment on column public.competitor_action_items.detail is
  'What competitors are doing, in a sentence or two.';
comment on column public.competitor_action_items.suggestion is
  'How Boxed2Built could match or beat it.';
comment on column public.competitor_action_items.competitor_names is
  'Which competitors were seen doing this, spelled as in competitors.name.';
comment on column public.competitor_action_items.status is
  'open = still to look at; done = ticked off by the owner; dismissed = removed by the owner as not relevant. The weekly run never changes this, and never suggests a done or dismissed item again.';
comment on column public.competitor_action_items.last_seen_on is
  'The last day (Central time) the weekly run saw a competitor still doing this.';

create unique index competitor_action_items_org_title_key
  on public.competitor_action_items (organization_id, lower(title));

create index competitor_action_items_org_status_idx
  on public.competitor_action_items (organization_id, status);

-- Keeps updated_at current on both tables.
create function public.competitor_watch_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.competitor_watch_touch_updated_at() from public, anon, authenticated;

create trigger competitors_touch_updated_at
  before update on public.competitors
  for each row execute function public.competitor_watch_touch_updated_at();

create trigger competitor_action_items_touch_updated_at
  before update on public.competitor_action_items
  for each row execute function public.competitor_watch_touch_updated_at();

-- Who ticked or removed an item, and when: from the session, not the request.
create function public.competitor_action_items_stamp_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.status_changed_at := now();
  new.status_changed_by := auth.uid();
  return new;
end;
$$;

revoke all on function public.competitor_action_items_stamp_status() from public, anon, authenticated;

create trigger competitor_action_items_stamp_status
  before update on public.competitor_action_items
  for each row
  when (old.status is distinct from new.status)
  execute function public.competitor_action_items_stamp_status();

-- The browser sends any timestamp to remove a competitor and null to restore
-- it. The time stored is the server's, and who did it is the signed-in user.
create function public.competitors_stamp_removed()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.removed_at is null then
    new.removed_by := null;
  elsif old.removed_at is null then
    new.removed_at := now();
    new.removed_by := auth.uid();
  else
    new.removed_at := old.removed_at;
    new.removed_by := old.removed_by;
  end if;
  return new;
end;
$$;

revoke all on function public.competitors_stamp_removed() from public, anon, authenticated;

create trigger competitors_stamp_removed
  before update on public.competitors
  for each row
  when (
    old.removed_at is distinct from new.removed_at
    or old.removed_by is distinct from new.removed_by
  )
  execute function public.competitors_stamp_removed();

alter table public.competitors enable row level security;
alter table public.competitor_action_items enable row level security;

revoke all on public.competitors from anon, authenticated;
revoke all on public.competitor_action_items from anon, authenticated;

grant select on public.competitors to authenticated;
grant update (removed_at) on public.competitors to authenticated;
grant select on public.competitor_action_items to authenticated;
grant update (status) on public.competitor_action_items to authenticated;

create policy "Org admins can read competitors"
  on public.competitors for select to authenticated
  using (public.can_manage_org_settings(organization_id));

create policy "Org admins can remove or restore competitors"
  on public.competitors for update to authenticated
  using (public.can_manage_org_settings(organization_id))
  with check (public.can_manage_org_settings(organization_id));

create policy "Org admins can read competitor action items"
  on public.competitor_action_items for select to authenticated
  using (public.can_manage_org_settings(organization_id));

create policy "Org admins can tick or remove competitor action items"
  on public.competitor_action_items for update to authenticated
  using (public.can_manage_org_settings(organization_id))
  with check (public.can_manage_org_settings(organization_id));
