/*
  # Fix Line Item Total Column Name in Trigger

  1. Issue
    - The calculate_line_item_total trigger function references NEW.line_total
    - The actual column name in the database is "total" not "line_total"
    - This causes the error: record "new" has no field "line_total"

  2. Changes
    - Update the calculate_line_item_total function to use NEW.total instead of NEW.line_total
    - This matches the actual column name in the invoice_line_items table

  3. Notes
    - Critical fix for adding/updating invoice line items
    - The column has always been named "total" in the schema
*/

-- Drop and recreate the function with the correct column name
CREATE OR REPLACE FUNCTION calculate_line_item_total()
RETURNS TRIGGER AS $$
BEGIN
  NEW.total := NEW.quantity * NEW.unit_price;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
