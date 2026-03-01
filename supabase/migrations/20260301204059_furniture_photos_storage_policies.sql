/*
  # Furniture Photos Storage Policies

  Allows anonymous users to upload images to the furniture-photos bucket
  (needed for public contact form submissions) and allows public read
  access so uploaded images can be displayed without authentication.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
    AND tablename = 'objects'
    AND policyname = 'Public can read furniture photos'
  ) THEN
    CREATE POLICY "Public can read furniture photos"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'furniture-photos');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
    AND tablename = 'objects'
    AND policyname = 'Anyone can upload furniture photos'
  ) THEN
    CREATE POLICY "Anyone can upload furniture photos"
      ON storage.objects FOR INSERT
      WITH CHECK (bucket_id = 'furniture-photos');
  END IF;
END $$;
