/*
  # Fix normalize_phone Function Search Path and Cleanup

  ## Summary
  1. Recreates the normalize_phone function with a fixed search_path to prevent
     search path injection attacks. The SET search_path = '' directive ensures
     the function always resolves objects using fully qualified names.
  2. Drops the unused index idx_client_notes_created_by to reduce unnecessary
     index maintenance overhead.

  ## Changes
  - Function public.normalize_phone: added SET search_path = ''
  - Index idx_client_notes_created_by: dropped (unused)
*/

CREATE OR REPLACE FUNCTION public.normalize_phone(p_phone text)
  RETURNS text
  LANGUAGE sql
  IMMUTABLE
  SET search_path = ''
AS $$
SELECT REGEXP_REPLACE(COALESCE(p_phone, ''), '[^0-9]', '', 'g');
$$;

DROP INDEX IF EXISTS public.idx_client_notes_created_by;
