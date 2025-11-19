/*
  # Remove category column from services table

  1. Changes
    - Drop the `category` column from the `services` table
    
  2. Notes
    - The category field is no longer needed as we now use dedicated price range fields:
      - min_price
      - max_price
      - price_range_description
    - This migration safely removes the column without affecting other table functionality
    - All existing data in the category column will be permanently deleted
*/

-- Remove the category column from services table
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'services' AND column_name = 'category'
  ) THEN
    ALTER TABLE services DROP COLUMN category;
  END IF;
END $$;