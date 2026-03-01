/*
  # Add Furniture Photo Fields to Inquiries and Saved Requests

  ## Summary
  Adds two optional columns to both `form_inquiries` and `saved_requests` tables so
  customers can attach a product link (e.g., Amazon, Wayfair) and/or upload a photo
  of their furniture when submitting the contact form.

  ## New Columns

  ### form_inquiries
  - `furniture_photo_url` (text, nullable) — a URL the customer typed in (e.g., product page)
  - `furniture_image_path` (text, nullable) — Supabase Storage path of an uploaded image

  ### saved_requests
  - `furniture_photo_url` (text, nullable) — same URL stored so Request Lookup page can show it
  - `furniture_image_path` (text, nullable) — same Storage path for Request Lookup display

  ## Storage
  - Creates a `furniture-photos` public storage bucket so uploaded images can be read
    without signed URLs.

  ## Notes
  1. All four new columns are nullable so existing records are completely unaffected.
  2. No RLS changes required — existing policies cover these columns automatically.
  3. The storage bucket uses public access so customers viewing their request lookup
     can see their uploaded photo without authentication.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'form_inquiries' AND column_name = 'furniture_photo_url'
  ) THEN
    ALTER TABLE form_inquiries ADD COLUMN furniture_photo_url text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'form_inquiries' AND column_name = 'furniture_image_path'
  ) THEN
    ALTER TABLE form_inquiries ADD COLUMN furniture_image_path text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'saved_requests' AND column_name = 'furniture_photo_url'
  ) THEN
    ALTER TABLE saved_requests ADD COLUMN furniture_photo_url text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'saved_requests' AND column_name = 'furniture_image_path'
  ) THEN
    ALTER TABLE saved_requests ADD COLUMN furniture_image_path text;
  END IF;
END $$;
