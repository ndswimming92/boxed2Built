/*
# Restrict identity-based functions to signed-in users only

## Summary
A group of database functions only do anything meaningful for a signed-in user
(they rely on the caller's logged-in identity: their account, their portal customer
record, or an admin allowlist check). These were also exposed to the `anon`
(not signed in) role, which is unnecessary surface area — a not-signed-in caller can
never satisfy their internal checks.

Every one of these functions is only ever called by the app AFTER the visitor has
signed in (admin login, customer portal login/linking, portal actions), so removing
the not-signed-in role does not change any app behaviour.

## What changes
Removes `anon` and generic `PUBLIC` EXECUTE from the functions below and confirms
`authenticated` keeps access.

### Functions restricted to signed-in users
- `claim_admin_membership()` — grants admin only to an allowlisted signed-in user.
- `get_my_referral_summary()` — returns the signed-in customer's referral stats.
- `upsert_my_marketing_consent(boolean, text)` — updates the signed-in user's consent.
- `submit_support_ticket(text, text, uuid, uuid, text)` — opens a portal ticket.
- `submit_job_customer_action_request(uuid, text, text, timestamptz)` — portal request.
- `submit_data_export_request()` — portal privacy request.
- `submit_account_deletion_request(integer)` — portal privacy request.
- `auto_create_portal_customer(text, text, text)` — runs during portal login.
- `auto_link_gmail_portal_account(text, text)` — runs during portal login.
- `consume_portal_account_link_token(text, text)` — runs during portal login.
- `track_portal_funnel_event(text, jsonb)` — portal analytics (after login).

## Security
- Closes the matching "Public Can Execute SECURITY DEFINER Function" findings for
  the `anon` role while preserving signed-in functionality.
- No row-level security policies are changed. No data is read, written, or deleted.

## Important notes
1. Token/code-guarded public lookups (invoice payment links, booking/request/gift-card
   code lookups, public audit/referral logging) are intentionally left callable by
   `anon` because the public pages that use them run before sign-in and are protected
   by the secret token or code the caller must supply.
*/

REVOKE EXECUTE ON FUNCTION public.claim_admin_membership() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_my_referral_summary() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.upsert_my_marketing_consent(boolean, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.submit_support_ticket(text, text, uuid, uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.submit_job_customer_action_request(uuid, text, text, timestamptz) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.submit_data_export_request() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.submit_account_deletion_request(integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.auto_create_portal_customer(text, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.auto_link_gmail_portal_account(text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.consume_portal_account_link_token(text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.track_portal_funnel_event(text, jsonb) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.claim_admin_membership() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_referral_summary() TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_my_marketing_consent(boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_support_ticket(text, text, uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_job_customer_action_request(uuid, text, text, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_data_export_request() TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_account_deletion_request(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.auto_create_portal_customer(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.auto_link_gmail_portal_account(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.consume_portal_account_link_token(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.track_portal_funnel_event(text, jsonb) TO authenticated;
