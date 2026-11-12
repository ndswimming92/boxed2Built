/*
  # Add service_type and room tags to gallery_items

  ## Summary
  Lets each gallery item be tagged with the service it shows and the room it
  belongs in, so the public gallery can be filtered by either. Both are
  optional: when left NULL the website detects them from the item title.

  ## Changes
  - `gallery_items.service_type` (text, nullable)
  - `gallery_items.room` (text, nullable)
*/

ALTER TABLE gallery_items
  ADD COLUMN IF NOT EXISTS service_type text
    CHECK (service_type IS NULL OR service_type IN ('furniture-assembly', 'tv-mounting', 'outdoor', 'wall-install')),
  ADD COLUMN IF NOT EXISTS room text
    CHECK (room IS NULL OR room IN ('living-room', 'bedroom', 'nursery', 'office', 'kitchen-dining', 'garage', 'patio-yard'));
