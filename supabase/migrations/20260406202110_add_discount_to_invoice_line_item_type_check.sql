/*
  # Add 'discount' to invoice_line_items item_type constraint

  1. Changes
    - Drops the existing `invoice_line_items_item_type_check` constraint
    - Re-adds it with 'discount' included as a valid item_type value

  2. Notes
    - Existing rows are unaffected (labor, material, other are all still valid)
    - No data loss occurs
*/

ALTER TABLE invoice_line_items DROP CONSTRAINT IF EXISTS invoice_line_items_item_type_check;

ALTER TABLE invoice_line_items
  ADD CONSTRAINT invoice_line_items_item_type_check
  CHECK (item_type = ANY (ARRAY['labor'::text, 'material'::text, 'other'::text, 'discount'::text]));
