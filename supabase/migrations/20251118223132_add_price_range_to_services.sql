/*
  # Add Price Range Fields to Services Table

  ## Overview
  This migration adds typical price range information to the services table,
  allowing businesses to communicate pricing flexibility and variations.

  ## Changes Made

  ### Modified Tables
  
  #### services
  - Added `min_price` (numeric) - Minimum typical price for the service
  - Added `max_price` (numeric) - Maximum typical price for the service
  - Added `price_range_description` (text) - Additional context about pricing variations

  ## Notes
  - All new fields are optional (nullable) to maintain backward compatibility
  - The typical price range complements the existing base_price field
  - Price range helps communicate potential cost variations based on complexity
  - No impact on existing data or RLS policies
*/

-- Add price range fields to services table
DO $$
BEGIN
  -- Add min_price column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'services' AND column_name = 'min_price'
  ) THEN
    ALTER TABLE services ADD COLUMN min_price numeric(10, 2);
  END IF;

  -- Add max_price column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'services' AND column_name = 'max_price'
  ) THEN
    ALTER TABLE services ADD COLUMN max_price numeric(10, 2);
  END IF;

  -- Add price_range_description column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'services' AND column_name = 'price_range_description'
  ) THEN
    ALTER TABLE services ADD COLUMN price_range_description text;
  END IF;
END $$;