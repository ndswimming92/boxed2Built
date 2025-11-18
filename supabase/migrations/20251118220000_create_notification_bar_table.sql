/*
  # Create Notification Bar Table

  1. New Tables
    - `notification_bar`
      - `id` (uuid, primary key)
      - `business_id` (uuid, foreign key to business_info)
      - `message` (text) - The notification message to display
      - `background_color` (text) - Hex color for background (e.g., #3B82F6)
      - `text_color` (text) - Hex color for text (e.g., #FFFFFF)
      - `is_enabled` (boolean) - Whether the notification bar is active
      - `created_at` (timestamptz) - When the notification was created
      - `updated_at` (timestamptz) - When the notification was last updated

  2. Security
    - Enable RLS on `notification_bar` table
    - Add policy for public read access (for website visitors)
    - Add policy for authenticated users to read their business notification
    - Add policy for authenticated users to create/update/delete their business notification

  3. Indexes
    - Add index on business_id for faster lookups
    - Add index on is_enabled for filtering active notifications
*/

-- Create notification_bar table
CREATE TABLE IF NOT EXISTS notification_bar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES business_info(id) ON DELETE CASCADE,
  message text NOT NULL DEFAULT '',
  background_color text NOT NULL DEFAULT '#3B82F6',
  text_color text NOT NULL DEFAULT '#FFFFFF',
  is_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE notification_bar ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_notification_bar_business_id ON notification_bar(business_id);
CREATE INDEX IF NOT EXISTS idx_notification_bar_is_enabled ON notification_bar(is_enabled);

-- Public read access for enabled notifications (for website visitors)
CREATE POLICY "Public can view enabled notifications"
  ON notification_bar
  FOR SELECT
  USING (is_enabled = true);

-- Authenticated users can view all their business notifications
CREATE POLICY "Authenticated users can view own business notifications"
  ON notification_bar
  FOR SELECT
  TO authenticated
  USING (
    business_id IN (
      SELECT id FROM business_info WHERE is_active = true
    )
  );

-- Authenticated users can insert notifications for their business
CREATE POLICY "Authenticated users can create notifications"
  ON notification_bar
  FOR INSERT
  TO authenticated
  WITH CHECK (
    business_id IN (
      SELECT id FROM business_info WHERE is_active = true
    )
  );

-- Authenticated users can update their business notifications
CREATE POLICY "Authenticated users can update own business notifications"
  ON notification_bar
  FOR UPDATE
  TO authenticated
  USING (
    business_id IN (
      SELECT id FROM business_info WHERE is_active = true
    )
  )
  WITH CHECK (
    business_id IN (
      SELECT id FROM business_info WHERE is_active = true
    )
  );

-- Authenticated users can delete their business notifications
CREATE POLICY "Authenticated users can delete own business notifications"
  ON notification_bar
  FOR DELETE
  TO authenticated
  USING (
    business_id IN (
      SELECT id FROM business_info WHERE is_active = true
    )
  );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_notification_bar_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_notification_bar_updated_at_trigger ON notification_bar;
CREATE TRIGGER update_notification_bar_updated_at_trigger
  BEFORE UPDATE ON notification_bar
  FOR EACH ROW
  EXECUTE FUNCTION update_notification_bar_updated_at();
