/*
  # Fix Expense Tax Year Calculation Bug

  1. Problem
    - The `tax_year` column has DEFAULT value of current year instead of 0
    - This causes the trigger to skip recalculation since it only acts when tax_year IS NULL OR = 0
    - Result: Expenses dated 2025 are incorrectly assigned to 2026

  2. Changes
    - Modify `business_expenses.tax_year` default from EXTRACT(YEAR FROM CURRENT_DATE) to 0
    - Update all existing records to recalculate tax_year from expense_date
    - This ensures expenses are correctly categorized by their actual date, not insertion date

  3. Data Correction
    - Recalculate tax_year for all existing expenses based on expense_date
    - This fixes any historical data that was incorrectly categorized

  4. Important Notes
    - After this fix, all new expenses will have tax_year properly calculated from expense_date
    - The trigger function already handles this logic correctly
    - No application code changes needed
*/

-- Change the default value for tax_year column to 0
ALTER TABLE business_expenses 
  ALTER COLUMN tax_year SET DEFAULT 0;

-- Update all existing expenses to have the correct tax_year based on their expense_date
UPDATE business_expenses
SET tax_year = EXTRACT(YEAR FROM expense_date)::integer
WHERE tax_year != EXTRACT(YEAR FROM expense_date)::integer;

-- Update the updated_at timestamp for corrected records
UPDATE business_expenses
SET updated_at = now()
WHERE tax_year = EXTRACT(YEAR FROM expense_date)::integer
  AND updated_at < now() - INTERVAL '1 minute';