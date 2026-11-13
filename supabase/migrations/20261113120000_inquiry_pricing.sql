/*
  # Inquiry pricing: a private price recommendation on each inquiry

  1. New table
    - `inquiry_pricing` — one row per inquiry, holding what only the owner
      should see while pricing it: the work address typed in by hand (the quote
      form does not ask for one) and the latest recommendation Claude wrote.
    Kept apart from `form_inquiries` on purpose. The customer's own request and
    the emails built from it read `form_inquiries`; nothing customer-facing
    reads this table, so a recommendation can never ride along into a quote.

  2. Writing
    - The browser cannot write here. The `inquiry-price-advice` edge function
      checks the caller is an admin, reloads the inquiry itself, and saves the
      address and the recommendation with the service role.

  3. Security
    - RLS on. Owners and admins only (`can_manage_org_settings`), read-only.
      `anon` has no access at all.
*/

create table public.inquiry_pricing (
  inquiry_id uuid primary key references public.form_inquiries(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  service_address text check (service_address is null or char_length(service_address) between 1 and 300),
  recommendation jsonb check (recommendation is null or jsonb_typeof(recommendation) = 'object'),
  recommended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.inquiry_pricing is
  'Owner-only pricing notes for an inquiry: the work address and Claude''s price recommendation. Written only by the inquiry-price-advice edge function. Never shown to the customer.';

alter table public.inquiry_pricing enable row level security;

revoke all on public.inquiry_pricing from anon, authenticated;
grant select on public.inquiry_pricing to authenticated;

create policy "Org admins can read inquiry pricing"
  on public.inquiry_pricing for select to authenticated
  using (public.can_manage_org_settings(organization_id));
