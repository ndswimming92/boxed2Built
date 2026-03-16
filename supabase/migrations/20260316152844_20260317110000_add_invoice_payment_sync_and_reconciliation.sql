/*
  # Invoice payment sync hardening (portal checkout, webhook, receipts, reconciliation)
*/

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text,
  ADD COLUMN IF NOT EXISTS stripe_payment_status text,
  ADD COLUMN IF NOT EXISTS stripe_payment_failure_reason text,
  ADD COLUMN IF NOT EXISTS stripe_refunded_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stripe_last_webhook_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_invoices_stripe_payment_intent_id
  ON public.invoices (stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.payment_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  provider_event_id text NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  processing_status text NOT NULL DEFAULT 'processed' CHECK (processing_status IN ('processed', 'failed')),
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider, provider_event_id)
);

CREATE INDEX IF NOT EXISTS idx_payment_webhook_events_created_at
  ON public.payment_webhook_events (created_at DESC);

ALTER TABLE public.payment_webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org admins can read payment webhook events" ON public.payment_webhook_events;
CREATE POLICY "Org admins can read payment webhook events"
  ON public.payment_webhook_events FOR SELECT TO authenticated
  USING (public.is_platform_admin());

DROP POLICY IF EXISTS "Service role can manage payment webhook events" ON public.payment_webhook_events;
CREATE POLICY "Service role can manage payment webhook events"
  ON public.payment_webhook_events FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.payment_reconciliation_candidates(p_limit integer DEFAULT 100)
RETURNS TABLE (
  invoice_id uuid,
  stripe_session_id text,
  stripe_payment_intent_id text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT i.id, i.stripe_session_id, i.stripe_payment_intent_id
  FROM public.invoices i
  WHERE i.is_active = true
    AND i.stripe_session_id IS NOT NULL
    AND i.status IN ('sent', 'partially_paid', 'overdue')
  ORDER BY i.updated_at ASC
  LIMIT GREATEST(COALESCE(p_limit, 100), 1);
$$;

REVOKE ALL ON FUNCTION public.payment_reconciliation_candidates(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.payment_reconciliation_candidates(integer) TO service_role;

INSERT INTO public.document_retention_rules (document_type, retention_days, hard_delete_enabled)
VALUES ('receipt', 2555, false)
ON CONFLICT (document_type) DO UPDATE
SET retention_days = EXCLUDED.retention_days,
    hard_delete_enabled = EXCLUDED.hard_delete_enabled,
    updated_at = now();
