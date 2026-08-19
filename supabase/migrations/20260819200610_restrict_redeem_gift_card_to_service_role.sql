-- F3: redeem_gift_card is SECURITY DEFINER and validated only the card's own
-- state, never the caller's identity, while being executable by anon and
-- authenticated. Anyone holding a gift card id could drain its balance through
-- the REST RPC endpoint. Redemption now goes exclusively through the
-- redeem-gift-card edge function, which resolves the caller to a platform admin
-- and then calls this routine with the service role.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'redeem_gift_card'
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', r.sig);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM authenticated', r.sig);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
  END LOOP;
END $$;
