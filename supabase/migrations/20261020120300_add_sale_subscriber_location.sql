/*
  # Where sales subscribers are, for the admin map

  Sign-up looks up an approximate city from the visitor's IP address and stores
  only the result: city, state, country and a rounded latitude/longitude (two
  decimals, about a kilometre). The IP address itself is never stored.

  All columns are optional. Subscribers from before this change, and anyone
  whose address could not be placed (private network, VPN, lookup down), have
  none and are counted as "location unknown" on the map.

  The admin read grant is widened to these columns; `unsubscribe_token` and
  `last_digest_at` stay unreadable.
*/

alter table public.sale_subscribers
  add column if not exists city text check (city is null or char_length(city) <= 100),
  add column if not exists region text check (region is null or char_length(region) <= 100),
  add column if not exists region_code text check (region_code is null or char_length(region_code) <= 10),
  add column if not exists country_code text check (country_code is null or char_length(country_code) = 2),
  add column if not exists latitude numeric(6, 2) check (latitude is null or latitude between -90 and 90),
  add column if not exists longitude numeric(6, 2) check (longitude is null or longitude between -180 and 180);

comment on column public.sale_subscribers.latitude is
  'Approximate, from the IP address at sign-up, rounded to 2 decimals. The IP itself is not kept.';

grant select (city, region, region_code, country_code, latitude, longitude)
  on public.sale_subscribers to authenticated;
