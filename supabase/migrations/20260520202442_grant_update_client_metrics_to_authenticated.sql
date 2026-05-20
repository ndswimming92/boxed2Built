/*
  # Restore EXECUTE grant on update_client_metrics

  1. Security Changes
    - Re-grants EXECUTE on `update_client_metrics(uuid)` to `authenticated` role
    - This permission was inadvertently dropped when the function was replaced
      in migration 20260520171358
*/

GRANT EXECUTE ON FUNCTION public.update_client_metrics(uuid) TO authenticated;
