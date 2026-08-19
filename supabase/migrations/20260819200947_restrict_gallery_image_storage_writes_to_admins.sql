-- F8: the gallery-images write policies were gated on the bucket name alone, so
-- ANY signed-in account (including a self-registered portal customer) could
-- overwrite or delete the public website's photos. Writes now require a platform
-- admin; public read is unchanged.
DROP POLICY IF EXISTS "Authenticated users can upload gallery images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update gallery images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete gallery images" ON storage.objects;

CREATE POLICY "Admins can upload gallery images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'gallery-images' AND public.is_platform_admin());

CREATE POLICY "Admins can update gallery images"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'gallery-images' AND public.is_platform_admin())
  WITH CHECK (bucket_id = 'gallery-images' AND public.is_platform_admin());

CREATE POLICY "Admins can delete gallery images"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'gallery-images' AND public.is_platform_admin());
