/*
  # Add hashtags to gallery_items

  ## Summary
  Adds a hashtags array so each gallery photo can carry a curated set of
  hashtags (AI-generated or manually edited) to append to the caption when
  the photo is published to Facebook/Instagram.

  ## Changes
  - `gallery_items.hashtags` (text[], default '{}') - hashtags for social publish
*/

ALTER TABLE gallery_items
  ADD COLUMN IF NOT EXISTS hashtags text[] NOT NULL DEFAULT '{}';
