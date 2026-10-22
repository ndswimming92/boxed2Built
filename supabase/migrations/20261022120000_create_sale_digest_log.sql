/*
  # Log of the daily sales emails

  One row per email the daily send attempts for a subscriber, so the admin can
  open a subscriber and see what went out to them and when.

  - `status` is `sent` or `failed`. A failed send leaves the subscriber's
    `last_digest_at` alone, so they catch up the next morning (and get a new row).
  - `sales` holds the title and store of each sale in that email, as it was
    sent, so the log still reads right after a sale is edited or removed.
  - `resend_email_id` ties the row to the message in Resend for delivery checks.

  Security: RLS on; org admins can read, writes are the service role only.
*/

create table public.sale_digest_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  subscriber_id uuid not null references public.sale_subscribers(id) on delete cascade,
  sent_at timestamptz not null default now(),
  status text not null check (status in ('sent', 'failed')),
  subject text not null,
  sale_count integer not null check (sale_count >= 0),
  sales jsonb not null default '[]'::jsonb,
  resend_email_id text,
  error text
);

create index sale_digest_log_subscriber_idx
  on public.sale_digest_log (subscriber_id, sent_at desc);

alter table public.sale_digest_log enable row level security;

revoke all on public.sale_digest_log from anon, authenticated;
grant select on public.sale_digest_log to authenticated;

create policy "Org admins can read sale digest log"
  on public.sale_digest_log for select to authenticated
  using (public.can_manage_org_settings(organization_id));
