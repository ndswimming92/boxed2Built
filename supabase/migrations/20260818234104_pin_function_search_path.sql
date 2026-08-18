/*
  # Pin the search_path on the remaining trigger functions

  Both functions resolved unqualified names at run time. Pinning the path
  removes the shadowing risk flagged by the database linter.
*/

ALTER FUNCTION public.set_subscription_updated_at() SET search_path TO 'public';
ALTER FUNCTION public.update_contractors_updated_at() SET search_path TO 'public';
