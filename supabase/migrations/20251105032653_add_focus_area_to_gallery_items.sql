/*
  # Add Focus Area Fields to Gallery Items

  1. Changes
    - Add `focus_x` column to store horizontal focus position (0-100, percentage from left)
    - Add `focus_y` column to store vertical focus position (0-100, percentage from top)
    - These fields allow specifying which part of an image should be prioritized when displayed
    - Default to center (50, 50) for existing images

  2. Notes
    - Focus values are percentages to work with any image size
    - 0,0 = top-left corner
    - 50,50 = center (default)
    - 100,100 = bottom-right corner
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'gallery_items' AND column_name = 'focus_x'
  ) THEN
    ALTER TABLE gallery_items ADD COLUMN focus_x numeric(5,2) DEFAULT 50.00;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'gallery_items' AND column_name = 'focus_y'
  ) THEN
    ALTER TABLE gallery_items ADD COLUMN focus_y numeric(5,2) DEFAULT 50.00;
  END IF;
END $$;