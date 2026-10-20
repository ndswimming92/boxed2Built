/*
  # Make the sign-up rate limit atomic

  The sales sign-up counted a connection's recent attempts and then, in a second
  step, recorded the new one. Requests arriving together could all pass the
  count before any of them recorded, so the five-an-hour limit did not hold
  under a parallel burst, and each sign-up sends an email to an address the
  visitor chose.

  `claim_sale_subscribe_slot` does the count and the insert as one step. A
  transaction-scoped advisory lock keyed on the connection makes simultaneous
  calls for the same connection take turns, so exactly `p_max` of them in a
  window get a slot. Calls for different connections do not wait on each other.

  Returns true when a slot was taken (go ahead), false when the limit is used
  up. It only counts and inserts; the edge function deletes rows older than the
  window afterwards. Only the service role can run it, and the edge function is
  the only caller.
*/

create index if not exists sale_subscribe_attempts_created_idx
  on public.sale_subscribe_attempts (created_at);

create function public.claim_sale_subscribe_slot(
  p_ip_key text,
  p_window_seconds integer,
  p_max integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  recent integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('sale_subscribe:' || p_ip_key, 0));

  select count(*) into recent
  from public.sale_subscribe_attempts
  where ip_key = left(p_ip_key, 100)
    and created_at >= now() - make_interval(secs => p_window_seconds);

  if recent >= p_max then
    return false;
  end if;

  insert into public.sale_subscribe_attempts (ip_key) values (left(p_ip_key, 100));
  return true;
end;
$$;

revoke all on function public.claim_sale_subscribe_slot(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.claim_sale_subscribe_slot(text, integer, integer) to service_role;
