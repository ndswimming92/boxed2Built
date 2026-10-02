/*
# Lock backend-only privileged functions away from the public API

## Why
Four SECURITY DEFINER functions were executable by the `anon` and `authenticated`
roles through the auto-generated REST API, but they contain NO internal
authorization check and are never called from the app frontend. They are only
ever run by trusted backend contexts (scheduled jobs and edge functions that use
the service-role key, which ignores these grants). Leaving them callable let any
signed-in customer-portal user read privileged data or trigger privileged
maintenance.

## Functions locked down
1. get_recent_audit_logs(integer) - returned audit-log rows (data exposure).
2. payment_reconciliation_candidates(integer) - returned unreconciled payment /
   invoice data (data exposure).
3. apply_late_fees_to_overdue_invoices() - mutated invoices in bulk (integrity).
4. apply_portal_document_retention_cleanup() - deleted/cleaned portal documents
   (destructive).

## Change
Revoke EXECUTE from PUBLIC, anon, and authenticated on each. The service role
used by cron jobs and edge functions is unaffected, so all legitimate callers
keep working.

## Notes
1. No function bodies are changed; only client EXECUTE grants are removed.
2. Idempotent: REVOKE is safe to re-run.
*/

REVOKE EXECUTE ON FUNCTION public.get_recent_audit_logs(integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.payment_reconciliation_candidates(integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_late_fees_to_overdue_invoices() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_portal_document_retention_cleanup() FROM PUBLIC, anon, authenticated;