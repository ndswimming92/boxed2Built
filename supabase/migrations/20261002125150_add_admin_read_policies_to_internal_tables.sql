/*
# Add explicit admin-only read policies to internal tables

## Summary
Five tables have row-level security turned on but no policies defined. With security
on and no policy, the tables are already fully locked to the website frontend (both
signed-out and signed-in visitors) — only trusted server-side code (edge functions
running with the service role, and SECURITY DEFINER functions) can touch them, which
is exactly the intent. No frontend code reads these tables.

To make that intent explicit and clear the "RLS enabled, no policy" warnings, this
migration adds a single read policy to each table that allows only platform admins to
read. It intentionally adds NO insert/update/delete policies, so writes remain
possible only through trusted server-side code.

### Tables and policies
1. `coupon_lookup_attempts` — admin read only (rate-limit log).
2. `gift_card_lookup_attempts` — admin read only (rate-limit log).
3. `oauth_states` — admin read only (short-lived OAuth handshake state).
4. `social_comment_dismissals` — admin read only.
5. `youtube_daily_snapshots` — admin read only (analytics snapshots).

## Security
- No access is granted to the `anon` (signed-out) role on any of these tables.
- Writes stay restricted to trusted server-side code.
- Uses the existing `is_platform_admin()` check used elsewhere in the schema.
*/

DROP POLICY IF EXISTS "Admins can read coupon lookup attempts" ON public.coupon_lookup_attempts;
CREATE POLICY "Admins can read coupon lookup attempts"
  ON public.coupon_lookup_attempts FOR SELECT
  TO authenticated
  USING (is_platform_admin());

DROP POLICY IF EXISTS "Admins can read gift card lookup attempts" ON public.gift_card_lookup_attempts;
CREATE POLICY "Admins can read gift card lookup attempts"
  ON public.gift_card_lookup_attempts FOR SELECT
  TO authenticated
  USING (is_platform_admin());

DROP POLICY IF EXISTS "Admins can read oauth states" ON public.oauth_states;
CREATE POLICY "Admins can read oauth states"
  ON public.oauth_states FOR SELECT
  TO authenticated
  USING (is_platform_admin());

DROP POLICY IF EXISTS "Admins can read social comment dismissals" ON public.social_comment_dismissals;
CREATE POLICY "Admins can read social comment dismissals"
  ON public.social_comment_dismissals FOR SELECT
  TO authenticated
  USING (is_platform_admin());

DROP POLICY IF EXISTS "Admins can read youtube daily snapshots" ON public.youtube_daily_snapshots;
CREATE POLICY "Admins can read youtube daily snapshots"
  ON public.youtube_daily_snapshots FOR SELECT
  TO authenticated
  USING (is_platform_admin());
