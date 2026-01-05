/*
  # Fix Line Item Total Column Reference
  
  ## Issue
  The trigger function `calculate_line_item_total()` references a column named `line_total`, 
  but the actual column in the `invoice_line_items` table is named `total`.
  
  This causes the error: "record 'new' has no field 'line_total'"
  
  ## Solution
  Update the trigger function to use the correct column name `total`.
*/

-- Recreate the function with correct column name
CREATE OR REPLACE FUNCTION calculate_line_item_total()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.total := NEW.quantity * NEW.unit_price;
  RETURN NEW;
END;
$$;