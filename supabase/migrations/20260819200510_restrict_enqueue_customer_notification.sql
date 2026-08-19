-- F1: enqueue_customer_notification was SECURITY DEFINER and executable by anon
-- and authenticated with no authorization check in the body, letting anyone queue
-- notifications and emails for any customer. It is only ever called from database
-- triggers (which run as the trigger owner) so no client role needs EXECUTE.
REVOKE EXECUTE ON FUNCTION public.enqueue_customer_notification(uuid, text, jsonb, boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.enqueue_customer_notification(uuid, text, jsonb, boolean) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.enqueue_customer_notification(uuid, text, jsonb, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enqueue_customer_notification(uuid, text, jsonb, boolean) TO service_role;
