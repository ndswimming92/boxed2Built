/*
  # Sales email subscribers

  Visitors can subscribe on /news to get the new sales by email each morning.
  This holds who subscribed, and the cursor the daily send works from.

  1. New table
    - `sale_subscribers` — one row per person per organization. Name and email
      are all we keep. `unsubscribe_token` is the unguessable value in the link
      at the bottom of every email; it is the only thing that can opt a row out,
      so it is never exposed to anonymous readers.
    - `status` is `active` or `unsubscribed`. Opting out keeps the row (with
      `unsubscribed_at`) rather than deleting it: the admin can see who opted
      out, and signing up again with the same email reactivates the same row
      instead of creating a duplicate.
    - `last_digest_at` is the "sent through" mark. The daily email carries the
      sales published after it, then moves it forward. A failed send leaves it
      alone, so that person catches up the next morning. It starts at the sign-up
      time, so a new subscriber gets sales approved from then on, not a backlog.

  2. Security
    - RLS on. Nobody anonymous can read or write the table: sign-up and opt-out
      go through the `sales-subscription` edge function, which uses the service
      role.
    - Org admins can read (the admin portal list). Writes stay with the service
      role. `unsubscribe_token` and `last_digest_at` are column-revoked from
      `authenticated`, so even the admin screen cannot read a token.

  3. Daily send
    - `send-sales-digest` is run hourly and sends only at 8 AM Central, so the
      send time holds through daylight saving. See
      20261020120100_schedule_sales_digest.sql.
*/

create table public.sale_subscribers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 100),
  email text not null check (char_length(email) between 3 and 254),
  email_normalized text generated always as (lower(btrim(email))) stored,
  status text not null default 'active' check (status in ('active', 'unsubscribed')),
  unsubscribe_token uuid not null default gen_random_uuid(),
  subscribed_at timestamptz not null default now(),
  unsubscribed_at timestamptz,
  last_digest_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sale_subscribers_org_email_key unique (organization_id, email_normalized),
  constraint sale_subscribers_token_key unique (unsubscribe_token)
);

comment on table public.sale_subscribers is
  'People who asked for the daily sales email. Written only by the sales-subscription edge function (service role).';
comment on column public.sale_subscribers.last_digest_at is
  'Sales published after this are not yet sent to this person. Reset to now() on every (re)subscribe.';

create index sale_subscribers_active_idx
  on public.sale_subscribers (organization_id)
  where status = 'active';

create function public.sale_subscribers_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.sale_subscribers_before_write() from public, anon, authenticated;

create trigger sale_subscribers_before_write
  before update on public.sale_subscribers
  for each row execute function public.sale_subscribers_before_write();

alter table public.sale_subscribers enable row level security;

revoke all on public.sale_subscribers from anon, authenticated;
grant select (
  id, organization_id, name, email, email_normalized, status,
  subscribed_at, unsubscribed_at, created_at, updated_at
) on public.sale_subscribers to authenticated;

create policy "Org admins can read sale subscribers"
  on public.sale_subscribers for select to authenticated
  using (public.can_manage_org_settings(organization_id));
