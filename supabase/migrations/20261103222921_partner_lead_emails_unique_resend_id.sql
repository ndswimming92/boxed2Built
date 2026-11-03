/*
  Applied to production on 2026-11-03 under this same version stamp.

  One log row per email Resend actually sent. A replayed idempotent response
  carries the id of the email already logged, so the send function's insert
  becomes a no-op instead of a second history row. NULLs stay distinct.
*/
create unique index partner_lead_emails_resend_id_key
  on public.partner_lead_emails (resend_id);
