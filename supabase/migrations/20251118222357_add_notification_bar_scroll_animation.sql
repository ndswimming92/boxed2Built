/*
  # Add Scroll Animation Fields to Notification Bar

  1. Schema Changes
    - Add `enable_scroll_animation` (boolean) - Toggle for continuous scrolling animation
    - Add `scroll_speed` (text) - Animation speed preset: 'slow', 'medium', or 'fast'

  2. Details
    - enable_scroll_animation defaults to false for backward compatibility
    - scroll_speed defaults to 'medium' for balanced animation
    - Uses IF NOT EXISTS pattern to safely add columns
    
  3. Purpose
    - Allows admins to enable eye-catching scrolling animations
    - Provides control over animation speed
    - Enhances notification bar engagement for important announcements
*/

-- Add enable_scroll_animation column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notification_bar' AND column_name = 'enable_scroll_animation'
  ) THEN
    ALTER TABLE notification_bar ADD COLUMN enable_scroll_animation boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- Add scroll_speed column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notification_bar' AND column_name = 'scroll_speed'
  ) THEN
    ALTER TABLE notification_bar ADD COLUMN scroll_speed text NOT NULL DEFAULT 'medium';
  END IF;
END $$;

-- Add check constraint for scroll_speed to ensure valid values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'notification_bar' AND constraint_name = 'notification_bar_scroll_speed_check'
  ) THEN
    ALTER TABLE notification_bar ADD CONSTRAINT notification_bar_scroll_speed_check 
      CHECK (scroll_speed IN ('slow', 'medium', 'fast'));
  END IF;
END $$;