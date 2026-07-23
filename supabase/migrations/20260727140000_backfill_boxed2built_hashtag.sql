/*
  # Backfill #Boxed2Built hashtag on gallery items

  ## Summary
  #Boxed2Built is now a required hashtag on every gallery image (enforced in
  the app and the AI-analysis edge function going forward). This backfills
  existing rows so previously-saved items also carry it.

  ## Changes
  - Append '#Boxed2Built' to `gallery_items.hashtags` for image items that
    don't already have it (case-insensitive check).
*/

UPDATE gallery_items
SET hashtags = array_append(hashtags, '#Boxed2Built')
WHERE type = 'image'
  AND NOT EXISTS (
    SELECT 1 FROM unnest(hashtags) AS tag WHERE lower(tag) = '#boxed2built'
  );
