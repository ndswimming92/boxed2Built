/*
  # Fix preferences token generation function

  ## Overview
  Updates the generate_preferences_token function to properly access pgcrypto
  by setting the search_path explicitly.

  ## Changes
  - Updates function to set search_path to include extensions schema
*/

-- Drop and recreate the function with proper search_path
DROP FUNCTION IF EXISTS generate_preferences_token();

CREATE OR REPLACE FUNCTION generate_preferences_token()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN encode(gen_random_bytes(32), 'hex');
END;
$$;

GRANT EXECUTE ON FUNCTION generate_preferences_token() TO authenticated;
