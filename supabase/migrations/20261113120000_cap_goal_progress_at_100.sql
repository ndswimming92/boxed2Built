/*
  # Cap goal progress at 100%

  1. Problem
    - calculate_goal_progress() stores current_value / target_value * 100 as is.
    - business_goals has CHECK (progress_percentage <= 100), so beating a
      target (say $900 against a $750 goal) fails the whole update.

  2. Solution
    - Clamp the stored percentage to the 0-100 range. current_value keeps the
      real figure, so nothing is lost.
*/

CREATE OR REPLACE FUNCTION public.calculate_goal_progress()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.target_value > 0 THEN
    NEW.progress_percentage := LEAST(100, GREATEST(0, ROUND((NEW.current_value::numeric / NEW.target_value::numeric) * 100, 2)));
  ELSE
    NEW.progress_percentage := 0;
  END IF;
  RETURN NEW;
END;
$$;
