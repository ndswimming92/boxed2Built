/*
  # Fix Business Goals Progress Trigger

  1. Problem
    - The calculate_goal_progress() function references NEW.progress
    - However, the business_goals table has progress_percentage, not progress
    - This causes "record 'new' has no field 'progress'" error on updates

  2. Solution
    - Recreate the calculate_goal_progress() function with correct column name
    - Change NEW.progress to NEW.progress_percentage
    - Maintain security settings (SECURITY DEFINER, search_path)

  3. Security
    - Keep SECURITY DEFINER with proper search_path to prevent vulnerabilities
*/

-- Fix calculate_goal_progress function with correct column name
CREATE OR REPLACE FUNCTION calculate_goal_progress()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.target_value > 0 THEN
    NEW.progress_percentage := ROUND((NEW.current_value::numeric / NEW.target_value::numeric) * 100, 2);
  ELSE
    NEW.progress_percentage := 0;
  END IF;
  RETURN NEW;
END;
$$;