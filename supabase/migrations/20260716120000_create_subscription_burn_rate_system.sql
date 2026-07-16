/*
  # Subscription & Cash Burn-Rate System

  Powers the Admin "Burn Rate" page, which answers: given the current cash
  balance and all recurring subscriptions, how long until the money runs out?

  1. New Tables
    - `business_subscriptions`
      - `id` (uuid, primary key)
      - `business_id` (uuid, foreign key to business_info)
      - `name` (text) - Subscription/vendor name (e.g., "Adobe Creative Cloud")
      - `description` (text) - Optional detail
      - `amount` (numeric) - Cost charged each billing cycle
      - `billing_cycle` (text) - weekly | biweekly | monthly | quarterly | semiannually | yearly
      - `next_due_date` (date) - When the next charge is expected
      - `category` (text) - Optional grouping (e.g., "Software", "Insurance")
      - `is_active` (boolean) - Active status (soft delete)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `business_balance_snapshots`
      - `id` (uuid, primary key)
      - `business_id` (uuid, foreign key to business_info)
      - `balance` (numeric) - Total cash on hand at the time recorded
      - `note` (text) - Optional note about the snapshot
      - `recorded_at` (date) - Effective date of this balance
      - `created_at` (timestamptz)
      The most recent snapshot (by recorded_at, then created_at) is treated as
      the "current balance"; earlier rows provide a balance history for charts.

  2. Security
    - Enable RLS on both tables
    - Policies mirror the existing business_expenses model: authenticated
      admin users can read/write

  3. Indexes
    - Foreign keys and frequently queried columns

  4. Triggers
    - Keep `updated_at` current on business_subscriptions
*/

-- Create business_subscriptions table
CREATE TABLE IF NOT EXISTS business_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES business_info(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  amount numeric(12, 2) NOT NULL CHECK (amount >= 0),
  billing_cycle text NOT NULL DEFAULT 'monthly'
    CHECK (billing_cycle IN ('weekly', 'biweekly', 'monthly', 'quarterly', 'semiannually', 'yearly')),
  next_due_date date,
  category text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create business_balance_snapshots table
CREATE TABLE IF NOT EXISTS business_balance_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES business_info(id) ON DELETE CASCADE,
  balance numeric(14, 2) NOT NULL,
  note text,
  recorded_at date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE business_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_balance_snapshots ENABLE ROW LEVEL SECURITY;

-- RLS Policies for business_subscriptions
CREATE POLICY "Authenticated users can view business subscriptions"
  ON business_subscriptions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert business subscriptions"
  ON business_subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update business subscriptions"
  ON business_subscriptions FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete business subscriptions"
  ON business_subscriptions FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for business_balance_snapshots
CREATE POLICY "Authenticated users can view balance snapshots"
  ON business_balance_snapshots FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert balance snapshots"
  ON business_balance_snapshots FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update balance snapshots"
  ON business_balance_snapshots FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete balance snapshots"
  ON business_balance_snapshots FOR DELETE
  TO authenticated
  USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_business_subscriptions_business_id ON business_subscriptions(business_id);
CREATE INDEX IF NOT EXISTS idx_business_subscriptions_is_active ON business_subscriptions(is_active);
CREATE INDEX IF NOT EXISTS idx_business_subscriptions_next_due_date ON business_subscriptions(next_due_date);

CREATE INDEX IF NOT EXISTS idx_business_balance_snapshots_business_id ON business_balance_snapshots(business_id);
CREATE INDEX IF NOT EXISTS idx_business_balance_snapshots_recorded_at ON business_balance_snapshots(recorded_at);

-- Trigger to keep updated_at fresh on business_subscriptions
CREATE OR REPLACE FUNCTION set_subscription_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_set_subscription_updated_at ON business_subscriptions;
CREATE TRIGGER trigger_set_subscription_updated_at
  BEFORE UPDATE ON business_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION set_subscription_updated_at();
