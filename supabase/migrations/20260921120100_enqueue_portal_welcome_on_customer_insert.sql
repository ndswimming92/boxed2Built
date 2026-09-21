/*
  # Queue the portal welcome sequence for self-registered customers too

  ## The gap
  `trg_customers_enqueue_portal_welcome_sequence` fires
  `AFTER UPDATE OF auth_user_id` and only when the row goes from
  `auth_user_id IS NULL` to NOT NULL — i.e. only when an existing customer
  record gets claimed by an auth user.

  A customer who signs up through the portal never takes that path:
  `auto_create_portal_customer` INSERTs their row with `auth_user_id` already
  populated. So self-registered customers silently never receive the three-step
  welcome sequence that manually-entered customers do.

  ## What this changes
  1. `handle_portal_welcome_sequence_on_customer_link()` gains SECURITY DEFINER.
     EXECUTE on `enqueue_portal_welcome_sequence_for_customer` was revoked from
     `authenticated` in 20260819200531; the link trigger works today only
     because every caller happens to already be a definer function. Making it
     explicit means the trigger no longer depends on its caller's rights.
  2. A matching INSERT trigger for rows created with `auth_user_id` already set.

  ## Why this cannot double-enqueue
  The UPDATE trigger requires `OLD.auth_user_id IS NULL`, which a row inserted
  with a non-null `auth_user_id` cannot satisfy without first being nulled (the
  FK is ON DELETE SET NULL, i.e. the auth user was deleted) — and re-linking
  after that is legitimate. Belt and braces:
  `enqueue_portal_welcome_sequence_for_customer` ends in
  `ON CONFLICT (customer_id, sequence_step) DO NOTHING` against the queue's
  unique constraint, so a second call is a complete no-op.

  ## Rollback
  DROP TRIGGER trg_customers_enqueue_portal_welcome_on_insert ON public.customers;
  DROP FUNCTION public.handle_portal_welcome_sequence_on_customer_insert();
*/

CREATE OR REPLACE FUNCTION public.handle_portal_welcome_sequence_on_customer_link()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.auth_user_id IS NULL AND NEW.auth_user_id IS NOT NULL THEN
    PERFORM public.enqueue_portal_welcome_sequence_for_customer(NEW.id);
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.handle_portal_welcome_sequence_on_customer_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.enqueue_portal_welcome_sequence_for_customer(NEW.id);
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_customers_enqueue_portal_welcome_on_insert ON public.customers;
CREATE TRIGGER trg_customers_enqueue_portal_welcome_on_insert
  AFTER INSERT ON public.customers
  FOR EACH ROW
  WHEN (NEW.auth_user_id IS NOT NULL)
  EXECUTE FUNCTION public.handle_portal_welcome_sequence_on_customer_insert();
