-- F9: the shop-images write policies were gated on the bucket name alone, so any
-- signed-in account could replace or delete the print shop's product photography.
DROP POLICY IF EXISTS "Authenticated users can upload shop images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update shop images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete shop images" ON storage.objects;

CREATE POLICY "Admins can upload shop images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'shop-images' AND public.is_platform_admin());

CREATE POLICY "Admins can update shop images"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'shop-images' AND public.is_platform_admin())
  WITH CHECK (bucket_id = 'shop-images' AND public.is_platform_admin());

CREATE POLICY "Admins can delete shop images"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'shop-images' AND public.is_platform_admin());
