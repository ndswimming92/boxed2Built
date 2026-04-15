/*
  # Add show_in_header to customer_reviews

  ## Summary
  Adds a boolean column `show_in_header` to the `customer_reviews` table to control
  which reviews rotate in the homepage hero section.

  ## Changes
  - `customer_reviews.show_in_header` (boolean, default false) — when true, this review
    is included in the auto-rotating testimonial in the site header/hero.

  ## Notes
  - No existing data is affected; all existing reviews default to false (not shown in header).
  - Admins can toggle individual reviews on/off from the Reviews admin page.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customer_reviews' AND column_name = 'show_in_header'
  ) THEN
    ALTER TABLE customer_reviews ADD COLUMN show_in_header boolean NOT NULL DEFAULT false;
  END IF;
END $$;
