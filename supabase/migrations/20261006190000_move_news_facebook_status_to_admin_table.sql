/*
  # News feed: keep Facebook post results admin-only

  `news_items` rows are readable by anonymous visitors once published, and the
  public feed selects every column. The Facebook post id, timestamp and raw
  Graph API error therefore must not live there.

  1. Drops `facebook_post_id`, `facebook_posted_at`, `facebook_post_error` from
     `news_items` (added a moment ago by 20261006180000; nothing reads them yet).
     `post_to_facebook` stays: it is only the admin's on/off switch.
  2. New table `news_facebook_posts`, one row per news item, holding the last
     successful post (`post_id`, `posted_at`) and the last failure
     (`last_error`). A failed retry only touches `last_error`, so an earlier
     successful post is never forgotten.
  3. RLS: org admins only. No grant to `anon`. The edge function writes with the
     service role.
*/

alter table public.news_items drop column if exists facebook_post_id;
alter table public.news_items drop column if exists facebook_posted_at;
alter table public.news_items drop column if exists facebook_post_error;

create table public.news_facebook_posts (
  news_item_id uuid primary key references public.news_items(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  post_id text,
  posted_at timestamptz,
  last_error text,
  updated_at timestamptz not null default now()
);

comment on table public.news_facebook_posts is
  'Result of posting a news item to the Facebook Page. Admin-only: last_error can contain raw Graph API messages.';

alter table public.news_facebook_posts enable row level security;

revoke all on public.news_facebook_posts from anon, authenticated;
grant select on public.news_facebook_posts to authenticated;

create policy "Org admins can select news facebook posts"
  on public.news_facebook_posts for select to authenticated
  using (public.can_manage_org_settings(organization_id));
