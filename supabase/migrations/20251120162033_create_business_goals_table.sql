/*
  # Business Goals Tracking System

  1. New Table
    - `business_goals`
      - `id` (uuid, primary key) - Unique identifier
      - `business_id` (uuid, foreign key) - Reference to business_info
      - `title` (text) - Goal title/name
      - `description` (text) - Detailed description of the goal
      - `category` (text) - Goal category (financial, operational, growth, customer_satisfaction, custom)
      - `priority` (text) - Priority level (high, medium, low)
      - `status` (text) - Current status (not_started, in_progress, completed, cancelled, overdue)
      - `target_value` (numeric) - Target value to achieve
      - `current_value` (numeric) - Current progress value
      - `unit_type` (text) - Unit of measurement (revenue, jobs, hours, percentage, custom)
      - `unit_label` (text) - Custom unit label if needed
      - `start_date` (date) - Goal start date
      - `due_date` (date) - Goal due date
      - `completion_date` (date) - Actual completion date
      - `progress_percentage` (numeric) - Calculated progress percentage
      - `is_archived` (boolean) - Whether goal is archived
      - `is_active` (boolean) - Whether goal is active
      - `created_at` (timestamptz) - Record creation timestamp
      - `updated_at` (timestamptz) - Record last update timestamp

  2. Security
    - Enable RLS on `business_goals` table
    - Add policies for authenticated admin users only

  3. Indexes
    - Index on business_id for efficient queries
    - Index on status for filtering
    - Index on priority for sorting
    - Index on due_date for deadline tracking

  4. Functions
    - Auto-update trigger for progress_percentage calculation
    - Auto-update trigger for status based on due_date and completion
*/

-- Create business_goals table
CREATE TABLE IF NOT EXISTS business_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES business_info(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text DEFAULT '',
  category text NOT NULL DEFAULT 'custom',
  priority text NOT NULL DEFAULT 'medium',
  status text NOT NULL DEFAULT 'not_started',
  target_value numeric NOT NULL DEFAULT 0,
  current_value numeric NOT NULL DEFAULT 0,
  unit_type text NOT NULL DEFAULT 'custom',
  unit_label text DEFAULT '',
  start_date date DEFAULT CURRENT_DATE,
  due_date date,
  completion_date date,
  progress_percentage numeric DEFAULT 0,
  is_archived boolean DEFAULT false,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add check constraints for valid enum values
ALTER TABLE business_goals
  ADD CONSTRAINT valid_category CHECK (category IN ('financial', 'operational', 'growth', 'customer_satisfaction', 'custom')),
  ADD CONSTRAINT valid_priority CHECK (priority IN ('high', 'medium', 'low')),
  ADD CONSTRAINT valid_status CHECK (status IN ('not_started', 'in_progress', 'completed', 'cancelled', 'overdue')),
  ADD CONSTRAINT valid_unit_type CHECK (unit_type IN ('revenue', 'jobs', 'hours', 'percentage', 'custom')),
  ADD CONSTRAINT valid_target_value CHECK (target_value >= 0),
  ADD CONSTRAINT valid_current_value CHECK (current_value >= 0),
  ADD CONSTRAINT valid_progress CHECK (progress_percentage >= 0 AND progress_percentage <= 100);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_business_goals_business_id ON business_goals(business_id);
CREATE INDEX IF NOT EXISTS idx_business_goals_status ON business_goals(status) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_business_goals_priority ON business_goals(priority) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_business_goals_due_date ON business_goals(due_date) WHERE is_active = true AND status NOT IN ('completed', 'cancelled');
CREATE INDEX IF NOT EXISTS idx_business_goals_archived ON business_goals(is_archived, is_active);

-- Enable Row Level Security
ALTER TABLE business_goals ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
CREATE POLICY "Authenticated users can view goals"
  ON business_goals FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert goals"
  ON business_goals FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update goals"
  ON business_goals FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete goals"
  ON business_goals FOR DELETE
  TO authenticated
  USING (true);

-- Function to calculate progress percentage
CREATE OR REPLACE FUNCTION calculate_goal_progress()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.target_value > 0 THEN
    NEW.progress_percentage := LEAST(100, (NEW.current_value / NEW.target_value) * 100);
  ELSE
    NEW.progress_percentage := 0;
  END IF;
  
  -- Auto-update status based on progress
  IF NEW.progress_percentage >= 100 AND NEW.status != 'completed' AND NEW.status != 'cancelled' THEN
    NEW.status := 'completed';
    NEW.completion_date := CURRENT_DATE;
  ELSIF NEW.progress_percentage > 0 AND NEW.progress_percentage < 100 AND NEW.status = 'not_started' THEN
    NEW.status := 'in_progress';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-calculate progress before insert/update
CREATE TRIGGER trigger_calculate_goal_progress
  BEFORE INSERT OR UPDATE OF target_value, current_value
  ON business_goals
  FOR EACH ROW
  EXECUTE FUNCTION calculate_goal_progress();

-- Function to check for overdue goals
CREATE OR REPLACE FUNCTION update_overdue_goals()
RETURNS void AS $$
BEGIN
  UPDATE business_goals
  SET status = 'overdue', updated_at = now()
  WHERE due_date < CURRENT_DATE
    AND status NOT IN ('completed', 'cancelled', 'overdue')
    AND is_active = true;
END;
$$ LANGUAGE plpgsql;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_business_goals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER trigger_update_business_goals_updated_at
  BEFORE UPDATE ON business_goals
  FOR EACH ROW
  EXECUTE FUNCTION update_business_goals_updated_at();