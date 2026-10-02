/*
# Lock down internal trigger functions from the public API

## Summary
Several internal database functions were callable over the public REST API by the
`anon` (not signed in) and `authenticated` (signed in) roles, even though they are
only ever meant to run automatically from database triggers. These functions should
never be invokable directly by a website visitor.

## What changes
This migration removes the ability for the `anon`, `authenticated`, and generic
`PUBLIC` roles to directly call these internal functions. The functions continue to
run normally when their triggers fire (trigger execution does not depend on these
grants), so no application behaviour changes — only the ability to call them directly
through the API is removed.

### Functions locked down
1. `rls_auto_enable()` — a database event trigger that auto-enables row security.
2. `log_auth_event()` — writes an audit record when auth rows change.
3. `propagate_client_contact_changes()` — syncs client contact edits.
4. `push_job_address_to_client()` — copies job address onto the client.
5. `sync_job_addresses()` — keeps job address fields consistent.

## Security
- Closes 5 "Public/Signed-In Users Can Execute SECURITY DEFINER Function" findings.
- No row-level security policies are changed.
- No data is read, written, or deleted.
*/

REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_auth_event() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.propagate_client_contact_changes() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.push_job_address_to_client() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_job_addresses() FROM PUBLIC, anon, authenticated;
