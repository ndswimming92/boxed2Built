-- Every event Sent (sent.dm) posts to the sent-webhook Edge Function.
create table if not exists public.sent_events (
  id uuid primary key default gen_random_uuid(),
  sent_event_id text not null unique,          -- X-Webhook-Event-ID, same on every retry
  field text not null,                          -- message | contact | channel | templates | link | call
  event_type text not null,                     -- e.g. message.delivered, contact.opt_out
  message_id text,
  contact_phone text,                           -- the customer's number (E.164)
  our_number text,                              -- our Sent number involved
  channel text,
  status text,
  body text,                                    -- outbound body or inbound text
  reason_code text,
  reason text,
  occurred_at timestamptz not null default now(),
  attempt int,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_sent_events_occurred_at on public.sent_events (occurred_at desc);
create index if not exists idx_sent_events_message_id on public.sent_events (message_id);
create index if not exists idx_sent_events_contact_phone on public.sent_events (contact_phone);
alter table public.sent_events enable row level security;

-- Current texting consent per phone number, driven by STOP / START signals from Sent.
create table if not exists public.sms_contact_status (
  phone_e164 text primary key,
  phone_digits text not null,                   -- last 10 digits, matches form phone fields
  opted_out boolean not null,
  last_event text not null,
  last_keyword text,
  last_signal_at timestamptz not null,
  updated_at timestamptz not null default now()
);
create index if not exists idx_sms_contact_status_digits on public.sms_contact_status (phone_digits);
alter table public.sms_contact_status enable row level security;

-- Applies a consent signal only if it is newer than what is stored (Sent can deliver out of order).
create or replace function public.apply_sms_consent_signal(
  p_phone text, p_opted_out boolean, p_event text, p_keyword text, p_signal_at timestamptz
) returns void
language sql
security definer
set search_path = public
as $$
  insert into public.sms_contact_status as s
    (phone_e164, phone_digits, opted_out, last_event, last_keyword, last_signal_at, updated_at)
  values
    (p_phone, right(regexp_replace(p_phone, '\D', '', 'g'), 10), p_opted_out, p_event, p_keyword, p_signal_at, now())
  on conflict (phone_e164) do update
    set opted_out = excluded.opted_out,
        last_event = excluded.last_event,
        last_keyword = excluded.last_keyword,
        last_signal_at = excluded.last_signal_at,
        updated_at = now()
    where s.last_signal_at <= excluded.last_signal_at;
$$;
revoke all on function public.apply_sms_consent_signal(text, boolean, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.apply_sms_consent_signal(text, boolean, text, text, timestamptz) to service_role;
