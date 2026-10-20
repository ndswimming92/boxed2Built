/*
  # Lock the same key that is counted

  claim_sale_subscribe_slot took its advisory lock on the raw connection key but
  counted and recorded attempts against the key cut to 100 characters. Two keys
  that differ only after the 100th character took different locks while sharing
  one count, so parallel requests could all read the same count and pass the
  limit.

  The key is now cut once, up front, and that one value is used for the lock,
  the count and the insert. The edge function also cuts the key to 100 characters
  before calling, so the two always agree.
*/

create or replace function public.claim_sale_subscribe_slot(
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
  v_key text := left(p_ip_key, 100);
  recent integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('sale_subscribe:' || v_key, 0));

  select count(*) into recent
  from public.sale_subscribe_attempts
  where ip_key = v_key
    and created_at >= now() - make_interval(secs => p_window_seconds);

  if recent >= p_max then
    return false;
  end if;

  insert into public.sale_subscribe_attempts (ip_key) values (v_key);
  return true;
end;
$$;
