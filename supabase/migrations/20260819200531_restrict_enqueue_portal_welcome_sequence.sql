-- F2: enqueue_portal_welcome_sequence_for_customer was SECURITY DEFINER and
-- executable by anon and authenticated with no authorization check, letting anyone
-- queue the three welcome emails for any customer id. It is invoked from database
-- triggers and server-side jobs only.
REVOKE EXECUTE ON FUNCTION public.enqueue_portal_welcome_sequence_for_customer(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.enqueue_portal_welcome_sequence_for_customer(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.enqueue_portal_welcome_sequence_for_customer(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enqueue_portal_welcome_sequence_for_customer(uuid) TO service_role;
