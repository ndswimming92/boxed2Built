/*
  # News feed: optional Facebook posting

  1. New columns on `news_items`
    - `post_to_facebook` — the admin's toggle on a draft. When true, approving
      the draft also posts it to the Boxed2Built Facebook Page.
    - `facebook_post_id`, `facebook_posted_at` — set once a post goes out, so
      the Published tab can show it and warn before posting twice.
    - `facebook_post_error` — the last failure, cleared on the next success.

  No policy changes: the existing org-admin update policy covers the columns.
*/

alter table public.news_items add column if not exists post_to_facebook boolean not null default false;
alter table public.news_items add column if not exists facebook_post_id text;
alter table public.news_items add column if not exists facebook_posted_at timestamptz;
alter table public.news_items add column if not exists facebook_post_error text;
