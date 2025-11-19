/*
  # Add Service Details to Services Table

  ## Overview
  This migration adds a field to store detailed bullet points describing what's included
  in each service. This allows businesses to clearly communicate service inclusions like
  "Full assembly", "Debris cleanup", "Placement in room", etc.

  ## Changes Made

  ### Modified Tables
  
  #### services
  - Added `included_items` (text[]) - Array of strings containing bullet points describing what's included in the service
    - Examples: "Full assembly", "Removal of boxes and cleanup", "Placement in room", "Quality inspection"
    - Displayed as bullet points on the services page
    - Managed through the admin portal

  ## Benefits
  - Clear communication of service inclusions
  - Easy to maintain and update through admin interface
  - Supports multiple bullet points per service
  - Helps customers understand exactly what they're getting

  ## Notes
  - Field is optional (nullable) to maintain backward compatibility
  - Empty arrays or null values won't affect existing services
  - Bullet points can be added/removed dynamically in admin portal
  - No impact on existing data or RLS policies
*/

-- Add included_items column to services table
DO $$
BEGIN
  -- Add included_items column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'services' AND column_name = 'included_items'
  ) THEN
    ALTER TABLE services ADD COLUMN included_items text[];
  END IF;
END $$;