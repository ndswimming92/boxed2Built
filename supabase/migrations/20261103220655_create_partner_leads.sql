/*
  # Partner Leads: local businesses worth asking about a referral partnership

  Applied to production on 2026-11-03 under this same version stamp through the
  Supabase connection. It is not idempotent, so do not re-run it by hand.

  1. New tables
    - `partner_leads` — one row per business near Spring Hill that sends people
      Boxed2Built's way: movers, apartment and townhome communities, property
      managers, realtors, builders, stagers, furniture stores and the like. Each
      row carries the business's published contact details, who to ask for,
      why it is a fit, and a draft outreach email written for it.
    - `partner_lead_emails` — every outreach email actually sent, exactly as it
      went out. Written only by the send-partner-outreach-email function.
    Leads are added by the daily "Boxed2Built partner leads" scheduled task and
    shown under Admin > Partner Leads. Nothing here is public.

  2. What the browser may change on a lead
    - `status` (new, contacted, talking, partner, not_a_fit, do_not_contact).
    - `draft_subject` / `draft_body`, so the owner can rewrite the email first.
    - `email`, `contact_name`, `contact_title`, so a wrong address or a better
      person can be corrected by hand.
    - `notes`, the owner's own notes.
    Everything else is written by the daily run through the database
    connection. The daily run only inserts new businesses; it never rewrites a
    lead that is already saved, so an edited draft or a status is never undone.

  3. Sending
    - The browser cannot send mail or write `partner_lead_emails`. The edge
      function checks the caller is an admin, reloads the lead itself, refuses
      `do_not_contact` and `not_a_fit` leads, sends through Resend and logs the
      email here with the service role.
    - `last_emailed_at` and `emails_sent` on the lead are set by that function
      too; the browser has no grant on them.

  4. Security
    - RLS on. Owners and admins only (`can_manage_org_settings`). `anon` has no
      access at all. `authenticated` is granted SELECT plus UPDATE on the
      columns above only.
    - Who changed a status, and when, is set by trigger from the session.
    - Web addresses must be http(s); emails must be a single plain address.
*/

create table public.partner_leads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 160),
  category text not null check (category in (
    'moving', 'apartments', 'townhomes_hoa', 'property_management', 'realtor',
    'home_builder', 'staging_design', 'furniture_retail', 'senior_living', 'other'
  )),
  location text check (location is null or char_length(location) between 1 and 200),
  summary text not null check (char_length(summary) between 1 and 600),
  why_fit text not null check (char_length(why_fit) between 1 and 1200),
  partnership_idea text check (partnership_idea is null or char_length(partnership_idea) between 1 and 1200),
  website_url text check (website_url is null or (website_url ~* '^https?://' and char_length(website_url) <= 2000)),
  email text check (email is null or (email ~ '^[^@[:space:],;<>]+@[^@[:space:],;<>]+\.[^@[:space:],;<>]+$' and char_length(email) <= 320)),
  email_source_url text check (email_source_url is null or (email_source_url ~* '^https?://' and char_length(email_source_url) <= 2000)),
  phone text check (phone is null or char_length(phone) between 1 and 60),
  contact_name text check (contact_name is null or char_length(contact_name) between 1 and 200),
  contact_title text check (contact_title is null or char_length(contact_title) between 1 and 200),
  links jsonb not null default '[]'::jsonb
    check (jsonb_typeof(links) = 'array' and jsonb_array_length(links) <= 12),
  draft_subject text check (draft_subject is null or char_length(draft_subject) between 1 and 200),
  draft_body text check (draft_body is null or char_length(draft_body) between 1 and 5000),
  notes text check (notes is null or char_length(notes) <= 4000),
  status text not null default 'new'
    check (status in ('new', 'contacted', 'talking', 'partner', 'not_a_fit', 'do_not_contact')),
  status_changed_at timestamptz,
  status_changed_by uuid references auth.users(id) on delete set null,
  last_emailed_at timestamptz,
  emails_sent integer not null default 0 check (emails_sent >= 0),
  found_on date not null default ((now() at time zone 'America/Chicago')::date),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.partner_leads is
  'Local businesses Boxed2Built could partner with for referrals, shown under Admin > Partner Leads. New rows come from the daily partner leads scheduled task. Owners and admins only; nothing is published.';
comment on column public.partner_leads.email is
  'An address the business itself publishes (its website, Google or Facebook business page, or a public business listing). Never a personal address found elsewhere.';
comment on column public.partner_leads.email_source_url is
  'The page the email was found on, so it can be checked before sending.';
comment on column public.partner_leads.contact_name is
  'The manager, owner or leasing/office lead to ask for, only as the business or a public business listing names them.';
comment on column public.partner_leads.status is
  'new = not contacted yet; contacted = emailed; talking = they replied; partner = a working partnership; not_a_fit = passed on; do_not_contact = asked not to be contacted. The send function refuses the last two. The daily run never changes this.';

create unique index partner_leads_org_name_key
  on public.partner_leads (organization_id, lower(name));
create index partner_leads_org_status_idx
  on public.partner_leads (organization_id, status);

create table public.partner_lead_emails (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lead_id uuid not null references public.partner_leads(id) on delete cascade,
  to_email text not null,
  subject text not null,
  body text not null,
  resend_id text,
  sent_by uuid references auth.users(id) on delete set null,
  sent_at timestamptz not null default now()
);

comment on table public.partner_lead_emails is
  'Every partnership outreach email sent from Admin > Partner Leads, exactly as sent. Written only by the send-partner-outreach-email edge function.';

create index partner_lead_emails_lead_idx on public.partner_lead_emails (lead_id, sent_at desc);

create function public.partner_leads_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  if old.status is distinct from new.status then
    new.status_changed_at := now();
    new.status_changed_by := auth.uid();
  end if;
  return new;
end;
$$;

revoke all on function public.partner_leads_touch_updated_at() from public, anon, authenticated;

create trigger partner_leads_touch_updated_at
  before update on public.partner_leads
  for each row execute function public.partner_leads_touch_updated_at();

alter table public.partner_leads enable row level security;
alter table public.partner_lead_emails enable row level security;

revoke all on public.partner_leads from anon, authenticated;
revoke all on public.partner_lead_emails from anon, authenticated;

grant select on public.partner_leads to authenticated;
grant update (status, draft_subject, draft_body, email, contact_name, contact_title, notes)
  on public.partner_leads to authenticated;
grant select on public.partner_lead_emails to authenticated;

create policy "Org admins can read partner leads"
  on public.partner_leads for select to authenticated
  using (public.can_manage_org_settings(organization_id));

create policy "Org admins can update partner leads"
  on public.partner_leads for update to authenticated
  using (public.can_manage_org_settings(organization_id))
  with check (public.can_manage_org_settings(organization_id));

create policy "Org admins can read partner outreach emails"
  on public.partner_lead_emails for select to authenticated
  using (public.can_manage_org_settings(organization_id));
