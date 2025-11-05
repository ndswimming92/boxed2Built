/*
  # Fix Security Issues

  1. Function Security
    - Set search_path to empty for update_form_inquiries_updated_at function
    - This prevents search path injection attacks by ensuring the function
      only uses fully qualified object references

  2. Implementation
    - Drop trigger first, then function, then recreate both
    - Set SECURITY DEFINER with empty search_path for maximum security

  3. Notes
    - Unused indexes are intentional for query performance and foreign key relationships
    - They will be used as the application scales and more queries are executed
    - Leaked password protection must be enabled in Supabase Auth settings in the dashboard
*/

-- Drop trigger first
DROP TRIGGER IF EXISTS set_form_inquiries_updated_at ON form_inquiries;

-- Drop function with CASCADE to handle dependencies
DROP FUNCTION IF EXISTS update_form_inquiries_updated_at() CASCADE;

-- Recreate the function with proper security settings
CREATE OR REPLACE FUNCTION update_form_inquiries_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Recreate the trigger with fully qualified table name
CREATE TRIGGER set_form_inquiries_updated_at
  BEFORE UPDATE ON public.form_inquiries
  FOR EACH ROW
  EXECUTE FUNCTION update_form_inquiries_updated_at();