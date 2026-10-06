/*
  # Add a `deals` topic to the news feed

  The daily news check now also looks for current sales at furniture stores in
  and around Spring Hill, TN. They are saved to `news_items` like any other
  item (as drafts, reviewed before they appear) under a third topic, which the
  public News page shows on its own "Deals" tab.

  1. Changes
    - `news_items.topic` check constraint: allow `deals` alongside `flat_pack`
      and `furniture_assembly`.

  Nothing else changes: same columns, same RLS, same draft-then-approve flow.
*/

alter table public.news_items drop constraint if exists news_items_topic_check;

alter table public.news_items
  add constraint news_items_topic_check
  check (topic in ('flat_pack', 'furniture_assembly', 'deals'));
