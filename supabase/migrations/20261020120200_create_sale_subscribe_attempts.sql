/*
  # Sign-up attempts, for the sales email rate limit

  The public `sales-subscription` function allows a few sign-ups per hour from
  one connection, so nobody can use the form to make us email a list of
  strangers. It needs somewhere to count attempts: one row per attempt, written
  and read only by the function (service role).

  RLS is on with no policies and no grants, so neither visitors nor the admin
  app can read the addresses of the connections that signed up. Old rows are
  deleted by the function as it goes.
*/

create table public.sale_subscribe_attempts (
  id uuid primary key default gen_random_uuid(),
  ip_key text not null check (char_length(ip_key) <= 100),
  created_at timestamptz not null default now()
);

create index sale_subscribe_attempts_ip_created_idx
  on public.sale_subscribe_attempts (ip_key, created_at desc);

alter table public.sale_subscribe_attempts enable row level security;
revoke all on public.sale_subscribe_attempts from anon, authenticated;
