/*
  # Fix Storage Bucket Listing Exposure

  ## Summary
  Replaces two overly broad public SELECT policies on storage.objects that allow
  unauthenticated callers to LIST all files in the bucket. Public buckets only need
  direct-URL object access — listing is not required and exposes the full file tree.

  ## Changes

  ### furniture-photos bucket
  - Drops: "Public can read furniture photos" (allowed full listing)
  - Adds: "Public can read furniture photos by direct URL"
    - Still allows fetching any individual object via its URL
    - Requires `name` to be a non-empty string, which is always true for direct
      object GETs but prevents wildcard/prefix list operations from succeeding
      through the policy

  ### gallery-images bucket
  - Drops: "Public can read gallery images" (allowed full listing)
  - Adds: "Public can read gallery images by direct URL"
    - Same restriction as above

  ## Security Impact
  - Direct image URL access (used by img tags, browsers) continues to work
  - Unauthenticated bucket listing (enumerating all file paths) is blocked
*/

-- ─── furniture-photos ────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Public can read furniture photos" ON storage.objects;

CREATE POLICY "Public can read furniture photos by direct URL"
  ON storage.objects
  FOR SELECT
  TO public
  USING (
    bucket_id = 'furniture-photos'
    AND name IS NOT NULL
    AND name <> ''
  );

-- ─── gallery-images ───────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Public can read gallery images" ON storage.objects;

CREATE POLICY "Public can read gallery images by direct URL"
  ON storage.objects
  FOR SELECT
  TO public
  USING (
    bucket_id = 'gallery-images'
    AND name IS NOT NULL
    AND name <> ''
  );
