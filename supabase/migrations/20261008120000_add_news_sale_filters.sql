/*
  # Sales filters: store, local or online, and furniture type

  The Sales tab is getting long and spans many stores, so visitors need to
  narrow it. `source_name` cannot do that: it names the site the story was read
  at (for example "Yahoo Shopping" for a Wayfair sale), not the store running
  the sale.

  1. Changes to `news_items` (all optional, so the daily check keeps working
     before it is taught to fill them)
    - `store_name` — the store running the sale, e.g. "Wayfair".
    - `store_slug` — generated from `store_name` for page links and filtering
      ("Bassett Home Furnishings" -> "bassett-home-furnishings"). Kept in step
      with `storeSlug()` in src/utils/news.ts.
    - `sale_scope` — `local` (a store near Spring Hill, TN) or `online`.
    - `furniture_types` — what the sale covers. A sale can cover several.

  2. New function `news_sale_filter_options()`
    - One row per store / scope / type combination among the live sales, with a
      count. The News page builds its filter chips and their counts from it, so
      it never has to read every sale to know which stores exist. It runs as
      the caller, so RLS decides what is visible, and it also leaves out
      expired sales so a signed-in admin sees what a visitor would.

  Existing sales have none of these set until an admin fills them in under
  Admin > News Feed > Edit. Until then they only appear when no filter is on.
*/

alter table public.news_items
  add column if not exists store_name text
    check (store_name is null or char_length(store_name) between 1 and 80),
  add column if not exists sale_scope text
    check (sale_scope is null or sale_scope in ('local', 'online')),
  add column if not exists furniture_types text[] not null default '{}'
    check (
      furniture_types <@ array[
        'living_room', 'bedroom', 'dining', 'office', 'outdoor',
        'mattresses', 'storage', 'rugs_decor'
      ]::text[]
    );

alter table public.news_items
  add column if not exists store_slug text
    generated always as (
      nullif(btrim(regexp_replace(lower(store_name), '[^a-z0-9]+', '-', 'g'), '-'), '')
    ) stored;

comment on column public.news_items.store_name is
  'Store running the sale (e.g. Wayfair). Not the same as source_name, which is the site the story was read at.';
comment on column public.news_items.sale_scope is
  'local = a store near Spring Hill, TN; online = online-only. Null = not set.';
comment on column public.news_items.furniture_types is
  'What the sale covers. Several allowed; empty = not set.';

create index if not exists news_items_deals_store_slug_idx
  on public.news_items (store_slug)
  where topic = 'deals' and status = 'published';

create or replace function public.news_sale_filter_options()
returns table (
  store_name text,
  store_slug text,
  sale_scope text,
  furniture_types text[],
  sale_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    n.store_name,
    n.store_slug,
    n.sale_scope,
    n.furniture_types,
    count(*) as sale_count
  from public.news_items n
  where n.topic = 'deals'
    and n.status = 'published'
    and (n.ends_on is null or n.ends_on >= (now() at time zone 'America/Chicago')::date)
  group by n.store_name, n.store_slug, n.sale_scope, n.furniture_types
$$;

revoke all on function public.news_sale_filter_options() from public;
grant execute on function public.news_sale_filter_options() to anon, authenticated;
