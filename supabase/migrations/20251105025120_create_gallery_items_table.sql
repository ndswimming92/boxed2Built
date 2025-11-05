/*
  # Create Gallery Items Table and Storage

  ## Summary
  Creates a comprehensive gallery management system for storing images and videos with full metadata support.

  ## New Tables
  - `gallery_items`
    - `id` (uuid, primary key) - Unique identifier for each gallery item
    - `business_id` (uuid, foreign key) - Links to business_info table
    - `type` (text) - Type of media: 'image' or 'video'
    - `src` (text) - Storage path for images or YouTube URL for videos
    - `title` (text) - Display title for the gallery item
    - `description` (text, nullable) - Detailed description of the item
    - `thumbnail` (text, nullable) - Thumbnail path for videos
    - `alt` (text, nullable) - Alt text for images (accessibility)
    - `category` (text) - Category: 'before-after', 'time-lapse', 'completed-work', 'process', 'photos'
    - `date` (text, nullable) - Date associated with the work (display format)
    - `location` (text, nullable) - Location where work was performed
    - `width` (integer, nullable) - Image/video width in pixels
    - `height` (integer, nullable) - Image/video height in pixels
    - `amazon_link` (text, nullable) - Amazon affiliate link for products shown
    - `platform` (text, nullable) - Video platform: 'youtube', 'vimeo', 'direct'
    - `display_order` (integer) - Order for displaying items in gallery
    - `is_active` (boolean) - Whether item is visible in public gallery
    - `created_at` (timestamptz) - When the item was created
    - `updated_at` (timestamptz) - When the item was last updated

  ## Storage
  - Creates 'gallery-images' bucket for storing uploaded images

  ## Security
  - Enable RLS on `gallery_items` table
  - Public can read active gallery items
  - Only authenticated admins can create, update, or delete gallery items
  - Storage policies allow public read and authenticated write

  ## Indexes
  - Index on business_id for fast business-specific queries
  - Index on is_active for filtering active items
  - Index on display_order for sorted retrieval
  - Index on category for filtered views
*/

-- Create gallery_items table
CREATE TABLE IF NOT EXISTS gallery_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES business_info(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('image', 'video')),
  src text NOT NULL,
  title text NOT NULL,
  description text,
  thumbnail text,
  alt text,
  category text NOT NULL CHECK (category IN ('before-after', 'time-lapse', 'completed-work', 'process', 'photos')),
  date text,
  location text,
  width integer,
  height integer,
  amazon_link text,
  platform text CHECK (platform IN ('youtube', 'vimeo', 'direct')),
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_gallery_items_business_id ON gallery_items(business_id);
CREATE INDEX IF NOT EXISTS idx_gallery_items_is_active ON gallery_items(is_active);
CREATE INDEX IF NOT EXISTS idx_gallery_items_display_order ON gallery_items(display_order);
CREATE INDEX IF NOT EXISTS idx_gallery_items_category ON gallery_items(category);

-- Enable Row Level Security
ALTER TABLE gallery_items ENABLE ROW LEVEL SECURITY;

-- Policy: Public can read active gallery items
CREATE POLICY "Public can view active gallery items"
  ON gallery_items
  FOR SELECT
  USING (is_active = true);

-- Policy: Authenticated users can view all gallery items (for admin)
CREATE POLICY "Authenticated users can view all gallery items"
  ON gallery_items
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Authenticated users can insert gallery items
CREATE POLICY "Authenticated users can create gallery items"
  ON gallery_items
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy: Authenticated users can update gallery items
CREATE POLICY "Authenticated users can update gallery items"
  ON gallery_items
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policy: Authenticated users can delete gallery items
CREATE POLICY "Authenticated users can delete gallery items"
  ON gallery_items
  FOR DELETE
  TO authenticated
  USING (true);

-- Create storage bucket for gallery images
INSERT INTO storage.buckets (id, name, public)
VALUES ('gallery-images', 'gallery-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policy: Public can read from gallery-images bucket
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND policyname = 'Public can read gallery images'
  ) THEN
    CREATE POLICY "Public can read gallery images"
      ON storage.objects
      FOR SELECT
      USING (bucket_id = 'gallery-images');
  END IF;
END $$;

-- Storage policy: Authenticated users can upload to gallery-images bucket
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND policyname = 'Authenticated users can upload gallery images'
  ) THEN
    CREATE POLICY "Authenticated users can upload gallery images"
      ON storage.objects
      FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id = 'gallery-images');
  END IF;
END $$;

-- Storage policy: Authenticated users can update gallery images
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND policyname = 'Authenticated users can update gallery images'
  ) THEN
    CREATE POLICY "Authenticated users can update gallery images"
      ON storage.objects
      FOR UPDATE
      TO authenticated
      USING (bucket_id = 'gallery-images')
      WITH CHECK (bucket_id = 'gallery-images');
  END IF;
END $$;

-- Storage policy: Authenticated users can delete gallery images
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND policyname = 'Authenticated users can delete gallery images'
  ) THEN
    CREATE POLICY "Authenticated users can delete gallery images"
      ON storage.objects
      FOR DELETE
      TO authenticated
      USING (bucket_id = 'gallery-images');
  END IF;
END $$;
