/*
  # In-portal support tickets with customer/job context and SLA metadata
*/

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  related_job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
  related_invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  subject text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'waiting_on_customer', 'resolved', 'closed')),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  sla_first_response_due_at timestamptz,
  sla_resolution_due_at timestamptz,
  first_response_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,
  last_customer_message_at timestamptz,
  last_admin_message_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.support_ticket_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  author_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  author_role text NOT NULL CHECK (author_role IN ('customer', 'admin', 'system')),
  message_body text NOT NULL,
  is_internal boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_customer_created
  ON public.support_tickets(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_tickets_org_status_updated
  ON public.support_tickets(organization_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_ticket_messages_ticket_created
  ON public.support_ticket_messages(ticket_id, created_at ASC);

DROP TRIGGER IF EXISTS trg_support_tickets_set_updated_at ON public.support_tickets;
CREATE TRIGGER trg_support_tickets_set_updated_at
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at_timestamp();

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_ticket_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customer can view own support tickets" ON public.support_tickets;
CREATE POLICY "Customer can view own support tickets"
  ON public.support_tickets
  FOR SELECT TO authenticated
  USING (customer_id = public.current_customer_id());

DROP POLICY IF EXISTS "Org members can view support tickets" ON public.support_tickets;
CREATE POLICY "Org members can view support tickets"
  ON public.support_tickets
  FOR SELECT TO authenticated
  USING (public.is_organization_member(organization_id));

DROP POLICY IF EXISTS "Org admins can update support tickets" ON public.support_tickets;
CREATE POLICY "Org admins can update support tickets"
  ON public.support_tickets
  FOR UPDATE TO authenticated
  USING (public.is_organization_admin(organization_id))
  WITH CHECK (public.is_organization_admin(organization_id));

DROP POLICY IF EXISTS "Customer can view own support ticket messages" ON public.support_ticket_messages;
CREATE POLICY "Customer can view own support ticket messages"
  ON public.support_ticket_messages
  FOR SELECT TO authenticated
  USING (customer_id = public.current_customer_id() AND is_internal = false);

DROP POLICY IF EXISTS "Org members can view support ticket messages" ON public.support_ticket_messages;
CREATE POLICY "Org members can view support ticket messages"
  ON public.support_ticket_messages
  FOR SELECT TO authenticated
  USING (public.is_organization_member(organization_id));

CREATE OR REPLACE FUNCTION public.submit_support_ticket(
  p_subject text,
  p_message text,
  p_related_job_id uuid DEFAULT NULL,
  p_related_invoice_id uuid DEFAULT NULL,
  p_priority text DEFAULT 'normal'
)
RETURNS public.support_tickets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id uuid := public.current_customer_id();
  v_job public.jobs%ROWTYPE;
  v_invoice public.invoices%ROWTYPE;
  v_ticket public.support_tickets%ROWTYPE;
BEGIN
  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'Portal access requires an authenticated customer account';
  END IF;

  IF COALESCE(length(btrim(p_subject)), 0) < 4 THEN
    RAISE EXCEPTION 'Please include a ticket subject (minimum 4 characters)';
  END IF;

  IF COALESCE(length(btrim(p_message)), 0) < 6 THEN
    RAISE EXCEPTION 'Please include a support message (minimum 6 characters)';
  END IF;

  IF lower(coalesce(p_priority, 'normal')) NOT IN ('low', 'normal', 'high', 'urgent') THEN
    RAISE EXCEPTION 'Invalid ticket priority';
  END IF;

  IF p_related_job_id IS NOT NULL THEN
    SELECT * INTO v_job FROM public.jobs WHERE id = p_related_job_id;
    IF v_job.id IS NULL OR v_job.customer_id <> v_customer_id THEN
      RAISE EXCEPTION 'Related job is not available for this customer';
    END IF;
  END IF;

  IF p_related_invoice_id IS NOT NULL THEN
    SELECT * INTO v_invoice FROM public.invoices WHERE id = p_related_invoice_id;
    IF v_invoice.id IS NULL OR v_invoice.customer_id <> v_customer_id THEN
      RAISE EXCEPTION 'Related invoice is not available for this customer';
    END IF;
  END IF;

  INSERT INTO public.support_tickets (
    organization_id,
    customer_id,
    related_job_id,
    related_invoice_id,
    subject,
    priority,
    sla_first_response_due_at,
    sla_resolution_due_at,
    last_customer_message_at
  ) VALUES (
    COALESCE(v_job.organization_id, v_invoice.organization_id, (SELECT c.organization_id FROM public.customers c WHERE c.id = v_customer_id)),
    v_customer_id,
    p_related_job_id,
    p_related_invoice_id,
    btrim(p_subject),
    lower(coalesce(p_priority, 'normal')),
    now() + interval '4 hours',
    now() + interval '2 days',
    now()
  ) RETURNING * INTO v_ticket;

  INSERT INTO public.support_ticket_messages (
    organization_id,
    ticket_id,
    customer_id,
    author_user_id,
    author_role,
    message_body
  ) VALUES (
    v_ticket.organization_id,
    v_ticket.id,
    v_ticket.customer_id,
    auth.uid(),
    'customer',
    btrim(p_message)
  );

  RETURN v_ticket;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_support_ticket(text, text, uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_support_ticket(text, text, uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_support_ticket(text, text, uuid, uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.add_support_ticket_message(
  p_ticket_id uuid,
  p_message text
)
RETURNS public.support_ticket_messages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id uuid := public.current_customer_id();
  v_ticket public.support_tickets%ROWTYPE;
  v_message public.support_ticket_messages%ROWTYPE;
BEGIN
  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'Portal access requires an authenticated customer account';
  END IF;

  IF COALESCE(length(btrim(p_message)), 0) < 2 THEN
    RAISE EXCEPTION 'Message cannot be empty';
  END IF;

  SELECT * INTO v_ticket FROM public.support_tickets WHERE id = p_ticket_id;

  IF v_ticket.id IS NULL OR v_ticket.customer_id <> v_customer_id THEN
    RAISE EXCEPTION 'Support ticket not found';
  END IF;

  INSERT INTO public.support_ticket_messages (
    organization_id,
    ticket_id,
    customer_id,
    author_user_id,
    author_role,
    message_body
  ) VALUES (
    v_ticket.organization_id,
    v_ticket.id,
    v_ticket.customer_id,
    auth.uid(),
    'customer',
    btrim(p_message)
  ) RETURNING * INTO v_message;

  UPDATE public.support_tickets
  SET status = CASE WHEN status = 'resolved' THEN 'waiting_on_customer' ELSE status END,
      last_customer_message_at = now(),
      updated_at = now()
  WHERE id = v_ticket.id;

  RETURN v_message;
END;
$$;

REVOKE ALL ON FUNCTION public.add_support_ticket_message(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_support_ticket_message(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_support_ticket_message(uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_add_support_ticket_message(
  p_ticket_id uuid,
  p_message text,
  p_is_internal boolean DEFAULT false
)
RETURNS public.support_ticket_messages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket public.support_tickets%ROWTYPE;
  v_message public.support_ticket_messages%ROWTYPE;
BEGIN
  IF COALESCE(length(btrim(p_message)), 0) < 2 THEN
    RAISE EXCEPTION 'Message cannot be empty';
  END IF;

  SELECT * INTO v_ticket FROM public.support_tickets WHERE id = p_ticket_id;

  IF v_ticket.id IS NULL THEN
    RAISE EXCEPTION 'Support ticket not found';
  END IF;

  IF NOT public.is_organization_member(v_ticket.organization_id) THEN
    RAISE EXCEPTION 'Not authorized to update this support ticket';
  END IF;

  INSERT INTO public.support_ticket_messages (
    organization_id,
    ticket_id,
    customer_id,
    author_user_id,
    author_role,
    message_body,
    is_internal
  ) VALUES (
    v_ticket.organization_id,
    v_ticket.id,
    v_ticket.customer_id,
    auth.uid(),
    'admin',
    btrim(p_message),
    coalesce(p_is_internal, false)
  ) RETURNING * INTO v_message;

  UPDATE public.support_tickets
  SET status = CASE WHEN status IN ('open', 'waiting_on_customer') AND coalesce(p_is_internal, false) = false THEN 'in_progress' ELSE status END,
      first_response_at = CASE WHEN first_response_at IS NULL AND coalesce(p_is_internal, false) = false THEN now() ELSE first_response_at END,
      last_admin_message_at = now(),
      updated_at = now()
  WHERE id = v_ticket.id;

  RETURN v_message;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_add_support_ticket_message(uuid, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_add_support_ticket_message(uuid, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_add_support_ticket_message(uuid, text, boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_update_support_ticket_status(
  p_ticket_id uuid,
  p_status text,
  p_note text DEFAULT NULL,
  p_priority text DEFAULT NULL
)
RETURNS public.support_tickets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket public.support_tickets%ROWTYPE;
  v_status text := lower(coalesce(p_status, ''));
  v_priority text := lower(coalesce(p_priority, ''));
BEGIN
  SELECT * INTO v_ticket FROM public.support_tickets WHERE id = p_ticket_id;

  IF v_ticket.id IS NULL THEN
    RAISE EXCEPTION 'Support ticket not found';
  END IF;

  IF NOT public.is_organization_member(v_ticket.organization_id) THEN
    RAISE EXCEPTION 'Not authorized to update this support ticket';
  END IF;

  IF v_status NOT IN ('open', 'in_progress', 'waiting_on_customer', 'resolved', 'closed') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;

  IF p_priority IS NOT NULL AND v_priority NOT IN ('low', 'normal', 'high', 'urgent') THEN
    RAISE EXCEPTION 'Invalid priority';
  END IF;

  UPDATE public.support_tickets
  SET status = v_status,
      priority = CASE WHEN p_priority IS NULL THEN priority ELSE v_priority END,
      first_response_at = CASE WHEN first_response_at IS NULL AND v_status <> 'open' THEN now() ELSE first_response_at END,
      resolved_at = CASE WHEN v_status = 'resolved' THEN now() ELSE resolved_at END,
      closed_at = CASE WHEN v_status = 'closed' THEN now() ELSE closed_at END,
      updated_at = now()
  WHERE id = v_ticket.id
  RETURNING * INTO v_ticket;

  INSERT INTO public.support_ticket_messages (
    organization_id,
    ticket_id,
    customer_id,
    author_user_id,
    author_role,
    message_body,
    is_internal,
    metadata
  ) VALUES (
    v_ticket.organization_id,
    v_ticket.id,
    v_ticket.customer_id,
    auth.uid(),
    'system',
    COALESCE(NULLIF(btrim(p_note), ''), format('Ticket status updated to %s', replace(v_status, '_', ' '))),
    false,
    jsonb_build_object('event_type', 'status_change', 'status', v_status)
  );

  RETURN v_ticket;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_support_ticket_status(uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_support_ticket_status(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_support_ticket_status(uuid, text, text, text) TO service_role;
