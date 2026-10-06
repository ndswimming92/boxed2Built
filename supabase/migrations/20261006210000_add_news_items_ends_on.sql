/*
  # Deals fall off the public feed after their end date

  1. Changes
    - `news_items.ends_on` (date, nullable): the last day a deal is valid. Null
      means no end date, so the item stays up until an admin unpublishes it.
    - Anonymous read policy now also requires the item not to have ended. An
      item stays visible through the whole of `ends_on` and drops off the next
      day, judged in Central time (Spring Hill, TN).
    - Authenticated read policy: the "or published" fallback gets the same
      rule, so a signed-in visitor who is not an org member cannot see expired
      items either. Org members still see everything, which keeps expired
      deals visible (and unpublishable) in Admin > News Feed.

  Expired rows stay `published`; they are hidden, not changed. Their source
  link stays reserved, so the daily check cannot re-add the same sale.
*/

alter table public.news_items
  add column if not exists ends_on date;

comment on column public.news_items.ends_on is
  'Last day the deal is valid (Central time). Null = no end date. The public feed hides the item from the following day.';

drop policy if exists "Anon select published news items" on public.news_items;
create policy "Anon select published news items"
  on public.news_items for select to anon
  using (
    status = 'published'
    and (ends_on is null or ends_on >= (now() at time zone 'America/Chicago')::date)
  );

drop policy if exists "Authenticated select news items" on public.news_items;
create policy "Authenticated select news items"
  on public.news_items for select to authenticated
  using (
    public.can_view_org_data(organization_id)
    or (
      status = 'published'
      and (ends_on is null or ends_on >= (now() at time zone 'America/Chicago')::date)
    )
  );
