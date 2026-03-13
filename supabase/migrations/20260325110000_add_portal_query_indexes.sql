/*
  # Add customer portal query indexes

  Improves high-volume portal reads:
  - jobs by customer and schedule/date recency
  - invoices by customer and status/date recency
  - notifications by customer read state/date recency
*/

CREATE INDEX IF NOT EXISTS idx_jobs_customer_scheduled_created
  ON public.jobs(customer_id, date_scheduled DESC, created_at DESC)
  WHERE customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_customer_status_invoice_date
  ON public.invoices(customer_id, status, invoice_date DESC, created_at DESC)
  WHERE customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_customer_notifications_customer_read_created
  ON public.customer_notifications(customer_id, is_read, created_at DESC);
