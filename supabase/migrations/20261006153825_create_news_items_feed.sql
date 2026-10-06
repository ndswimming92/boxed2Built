/*
  # News feed: furniture assembly and flat pack furniture news

  Already applied to production on 2026-10-06 under this same version stamp.
  It is not idempotent, so do not re-run it by hand.

  1. New table
    - `news_items` — one row per story. Rows arrive as `draft` from the daily
      scheduled news check and only appear on the public /news page once an
      admin sets `status = 'published'` from Admin > News Feed.
    - `unique (organization_id, source_url)` is what stops the daily check
      saving the same story twice. Rejected rows are kept for the same reason.

  2. Security
    - RLS on. Anonymous visitors can read published rows only.
    - Signed-in org members can read everything for their organization.
    - Only org admins can insert, update or delete.
    - `anon` is granted SELECT and nothing else, so even a policy mistake
      could not let a visitor write.
    - `source_url` must be http(s), so a stored value can never be a
      `javascript:` link. src/utils/news.ts checks again before rendering.

  3. Trigger
    - `news_items_before_write` keeps `updated_at` current and stamps
      `published_at` the first time a row is published. Unpublishing and
      republishing keeps the original date, so the item returns to its old
      place in the feed rather than jumping to the top.
*/

create table public.news_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  summary text not null check (char_length(summary) between 1 and 1000),
  source_name text not null check (char_length(source_name) between 1 and 120),
  source_url text not null check (source_url ~* '^https?://' and char_length(source_url) <= 2000),
  topic text not null check (topic in ('flat_pack', 'furniture_assembly')),
  source_published_on date,
  status text not null default 'draft' check (status in ('draft', 'published', 'rejected')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint news_items_org_source_url_key unique (organization_id, source_url)
);

comment on table public.news_items is
  'Furniture assembly and flat pack news feed. Drafts are added by a daily scheduled check; only status = ''published'' rows are publicly readable.';
comment on column public.news_items.source_published_on is
  'Date the source published the story, when known. Null if the date could not be confirmed.';
comment on column public.news_items.published_at is
  'When the item went live on the website. Set automatically the first time status becomes ''published''.';

create index news_items_status_published_at_idx
  on public.news_items (status, published_at desc);

create function public.news_items_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    new.updated_at := now();
  end if;
  if new.status = 'published' and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end;
$$;

revoke all on function public.news_items_before_write() from public, anon, authenticated;

create trigger news_items_before_write
  before insert or update on public.news_items
  for each row execute function public.news_items_before_write();

alter table public.news_items enable row level security;

revoke all on public.news_items from anon, authenticated;
grant select on public.news_items to anon;
grant select, insert, update, delete on public.news_items to authenticated;

create policy "Anon select published news items"
  on public.news_items for select to anon
  using (status = 'published');

create policy "Authenticated select news items"
  on public.news_items for select to authenticated
  using (public.can_view_org_data(organization_id) or status = 'published');

create policy "Org admins can insert news items"
  on public.news_items for insert to authenticated
  with check (public.can_manage_org_settings(organization_id));

create policy "Org admins can update news items"
  on public.news_items for update to authenticated
  using (public.can_manage_org_settings(organization_id))
  with check (public.can_manage_org_settings(organization_id));

create policy "Org admins can delete news items"
  on public.news_items for delete to authenticated
  using (public.can_manage_org_settings(organization_id));
