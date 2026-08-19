-- F13: the furniture-photos bucket accepts anonymous uploads (the quote form needs
-- that) but placed no bound on size or content type, so anyone could store
-- arbitrary files of any size and serve them from the project's storage domain.
-- The storage API enforces these two limits server-side on every upload.
UPDATE storage.buckets
SET file_size_limit = 10485760, -- 10 MB
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
WHERE id = 'furniture-photos';
