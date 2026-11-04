/*
  # Partner referral codes and outreach email activity

  1. Partner codes
     - `partner_leads.coupon_id` links a lead to the coupon made for it, so a
       customer the partner sends gets a discount by typing the partner's code
       on the request form (or arriving from /contact?coupon=CODE), and the lead
       card can show how often it was used. The coupon is an ordinary row in
       `coupons`, so it also shows under Admin > Coupons and goes through the
       same lookup, snapshot and usage counter as every other code.
     - `create_partner_lead_code(lead, code, type, value)` makes that coupon and
       links it in one step. SECURITY DEFINER, but it checks the caller is an
       owner or admin of the lead's organization first. A lead that already has
       a code gets that code back rather than a second one. A code already in
       use anywhere raises unique_violation (23505), which the page reports.
       The browser is not granted UPDATE on `coupon_id`; this function is the
       only way it is set.

  2. Email activity
     - `get_partner_lead_email_activity(org)` returns the Resend delivery,
       open, click and bounce events for that organization's partner outreach
       emails, joined on `partner_lead_emails.resend_id = email_events.message_id`.
       `email_events` itself stays readable by platform admins only; this
       function exposes just these columns for just these emails, and only to
       owners and admins of the organization (`can_manage_org_settings`).
*/

alter table public.partner_leads
  add column if not exists coupon_id uuid references public.coupons(id) on delete set null;

create index if not exists idx_partner_leads_coupon_id on public.partner_leads (coupon_id);

comment on column public.partner_leads.coupon_id is
  'The coupon made for this partner (create_partner_lead_code). Customers they send use it for a discount; coupons.times_used counts them.';

create or replace function public.create_partner_lead_code(
  p_lead_id uuid,
  p_code text,
  p_discount_type text default 'fixed',
  p_discount_value numeric default 25
)
returns public.coupons
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lead public.partner_leads;
  v_coupon public.coupons;
  v_business uuid;
begin
  select * into v_lead from public.partner_leads where id = p_lead_id for update;
  if v_lead.id is null or not public.can_manage_org_settings(v_lead.organization_id) then
    raise exception 'Lead not found or not allowed' using errcode = '42501';
  end if;

  if v_lead.coupon_id is not null then
    select * into v_coupon from public.coupons where id = v_lead.coupon_id;
    if found then
      return v_coupon;
    end if;
  end if;

  select id into v_business from public.business_info
   where organization_id = v_lead.organization_id
   limit 1;

  insert into public.coupons (business_id, organization_id, created_by, code, description, discount_type, discount_value)
  values (
    v_business,
    v_lead.organization_id,
    auth.uid(),
    upper(btrim(p_code)),
    left('Partner code for ' || v_lead.name, 200),
    p_discount_type,
    p_discount_value
  )
  returning * into v_coupon;

  update public.partner_leads set coupon_id = v_coupon.id where id = v_lead.id;

  return v_coupon;
end;
$$;

revoke all on function public.create_partner_lead_code(uuid, text, text, numeric) from public, anon;
grant execute on function public.create_partner_lead_code(uuid, text, text, numeric) to authenticated;

create or replace function public.get_partner_lead_email_activity(p_organization_id uuid)
returns table (email_id uuid, event_type text, occurred_at timestamptz, link text)
language sql
stable
security definer
set search_path = public
as $$
  select e.id, ev.event_type, ev.occurred_at, nullif(ev.payload #>> '{data,click,link}', '')
    from public.partner_lead_emails e
    join public.email_events ev on ev.message_id = e.resend_id
   where e.organization_id = p_organization_id
     and e.resend_id is not null
     and public.can_manage_org_settings(p_organization_id)
     and ev.event_type in (
       'email.delivered', 'email.opened', 'email.clicked',
       'email.bounced', 'email.complained', 'email.delivery_delayed'
     )
   order by ev.occurred_at, e.id, ev.event_type, ev.id;
$$;

revoke all on function public.get_partner_lead_email_activity(uuid) from public, anon;
grant execute on function public.get_partner_lead_email_activity(uuid) to authenticated;
