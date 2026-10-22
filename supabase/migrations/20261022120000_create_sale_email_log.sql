/*
  # Sales email log

  One row per sales email actually handed to the mail provider, so the admin
  can open a subscriber and see what went out to them and when.

  - `sale_email_log` — written only by `send-sales-digest` (service role).
    Holds the subject, how many sales it carried, their titles, and the
    provider's message id. Failed sends are not logged (they are retried).
  - RLS on; org admins can read. Rows go when the subscriber is deleted.
*/

create table public.sale_email_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  subscriber_id uuid not null references public.sale_subscribers(id) on delete cascade,
  sent_at timestamptz not null default now(),
  subject text not null,
  sale_count integer not null default 0,
  sale_titles text[] not null default '{}',
  provider_message_id text
);

create index sale_email_log_subscriber_idx
  on public.sale_email_log (subscriber_id, sent_at desc);

alter table public.sale_email_log enable row level security;

revoke all on public.sale_email_log from anon, authenticated;
grant select on public.sale_email_log to authenticated;

create policy "Org admins can read sale email log"
  on public.sale_email_log for select to authenticated
  using (public.can_manage_org_settings(organization_id));
