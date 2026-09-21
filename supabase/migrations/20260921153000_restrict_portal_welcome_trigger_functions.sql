/*
  # Lock down the portal welcome-sequence trigger functions

  ## What went wrong
  20260921120100 made both welcome-sequence trigger functions SECURITY DEFINER, so
  that they no longer depend on the caller holding EXECUTE on
  `enqueue_portal_welcome_sequence_for_customer` — which 20260819200531
  deliberately restricted to `service_role`.

  That part was right. What it missed is that both functions kept the default
  PUBLIC grant, which made them definer-rights wrappers around the restricted
  function, reachable by `anon` and `authenticated` through
  `/rest/v1/rpc/`. Exactly the shape 20260819200531 was closing, reopened through
  the back door.

  Calling a plpgsql trigger function outside a trigger raises
  "trigger functions can only be called as triggers" before the body runs, so this
  was not exploitable in practice. "PostgREST happens to reject it first" is not a
  guarantee worth resting on, and Supabase's own linter flags it
  (0028_anon_security_definer_function_executable).

  ## Why revoking cannot break the triggers
  PostgreSQL checks EXECUTE on a trigger function at CREATE TRIGGER time, not on
  each fire. Both triggers on public.customers keep working:
    - trg_customers_enqueue_portal_welcome_on_insert
    - trg_customers_enqueue_portal_welcome_sequence

  ## Rollback
  GRANT EXECUTE ON FUNCTION ... TO anon, authenticated;
  (but there is no reason to — nothing calls these except the triggers)
*/

REVOKE ALL ON FUNCTION public.handle_portal_welcome_sequence_on_customer_insert() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_portal_welcome_sequence_on_customer_insert() FROM anon;
REVOKE ALL ON FUNCTION public.handle_portal_welcome_sequence_on_customer_insert() FROM authenticated;

REVOKE ALL ON FUNCTION public.handle_portal_welcome_sequence_on_customer_link() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_portal_welcome_sequence_on_customer_link() FROM anon;
REVOKE ALL ON FUNCTION public.handle_portal_welcome_sequence_on_customer_link() FROM authenticated;
