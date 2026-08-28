/*
  # Stop `record_coupon_use` being callable over the API

  1. Problem
     `public.record_coupon_use()` is the trigger that keeps `coupons.times_used`
     up to date. It has to be SECURITY DEFINER, because the `anon` role that
     inserts an inquiry has no rights on `coupons` — but being SECURITY DEFINER
     in the `public` schema also means PostgREST publishes it at
     `/rest/v1/rpc/record_coupon_use`, where anyone could call it. The database
     linter flags this as `0028_anon_security_definer_function_executable`.

     Calling it directly fails anyway (a trigger function has no NEW record to
     work with), so nothing was exploitable. It should still not be reachable.

  2. Change
     Revoke EXECUTE from PUBLIC, `anon` and `authenticated`. PostgreSQL checks
     EXECUTE on a trigger function when the trigger is created, not each time it
     fires, so the counter keeps working for inquiries submitted anonymously —
     verified against a scratch Postgres before shipping.

     `lookup_coupon_by_code` keeps its grant: that one is meant to be public.
*/

REVOKE ALL ON FUNCTION public.record_coupon_use() FROM PUBLIC, anon, authenticated;
