/*
  # Fix Line Item Trigger

  1. Issue
    - The calculate_line_item_total trigger was missing a semicolon
    - This prevented line items from being inserted properly
    - Error: record "new" has no field "invoice_id"

  2. Changes
    - Drop and recreate the trigger with proper syntax
    - Ensure the trigger correctly calculates line item totals before insert/update

  3. Notes
    - This is a critical fix for invoice line item creation
    - The trigger multiplies quantity × unit_price to get the total
*/

-- Drop the existing trigger
DROP TRIGGER IF EXISTS trg_calculate_line_item_total ON invoice_line_items;

-- Recreate the function to ensure it's correct
CREATE OR REPLACE FUNCTION calculate_line_item_total()
RETURNS TRIGGER AS $$
BEGIN
  NEW.total := NEW.quantity * NEW.unit_price;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger with proper syntax
CREATE TRIGGER trg_calculate_line_item_total
  BEFORE INSERT OR UPDATE ON invoice_line_items
  FOR EACH ROW
  EXECUTE FUNCTION calculate_line_item_total();
