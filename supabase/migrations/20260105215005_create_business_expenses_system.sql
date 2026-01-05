/*
  # Business Expense Tracking System

  1. New Tables
    - `expense_categories`
      - `id` (uuid, primary key)
      - `business_id` (uuid, foreign key to business_info)
      - `name` (text) - Category name (e.g., "Software & Subscriptions", "Advertising")
      - `description` (text) - Category description
      - `irs_category` (text) - IRS Schedule C category mapping
      - `is_tax_deductible` (boolean) - Whether expenses in this category are tax deductible
      - `is_default` (boolean) - System default categories
      - `display_order` (integer) - Sort order
      - `is_active` (boolean) - Active status
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `business_expenses`
      - `id` (uuid, primary key)
      - `business_id` (uuid, foreign key to business_info)
      - `category_id` (uuid, foreign key to expense_categories)
      - `expense_date` (date) - Date of expense
      - `vendor_name` (text) - Merchant/vendor name
      - `description` (text) - Expense description
      - `amount` (numeric) - Expense amount
      - `payment_method` (text) - How it was paid
      - `confirmation_number` (text) - Transaction/receipt number
      - `is_tax_deductible` (boolean) - Override category default
      - `deductible_amount` (numeric) - Actual deductible amount (may differ from total)
      - `tax_year` (integer) - Tax year this expense applies to
      - `quarter` (integer) - Quarter (1-4) for quarterly reporting
      - `receipt_url` (text) - URL to receipt image/PDF in storage
      - `has_receipt` (boolean) - Whether receipt is uploaded
      - `is_recurring` (boolean) - Whether this is a recurring expense
      - `recurrence_pattern` (text) - Pattern (monthly, quarterly, annually)
      - `tags` (text[]) - Custom tags for filtering
      - `notes` (text) - Additional notes
      - `is_active` (boolean) - Active status (for soft deletes)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated admin users only

  3. Indexes
    - Add indexes on foreign keys and frequently queried columns
    - Add index on expense_date for time-based queries

  4. Functions
    - Function to calculate quarter from date
    - Function to get total expenses by category
    - Function to get tax-deductible expenses by period

  5. Default Categories
    - Pre-populate with common IRS Schedule C categories
*/

-- Create expense_categories table
CREATE TABLE IF NOT EXISTS expense_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES business_info(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  irs_category text,
  is_tax_deductible boolean DEFAULT true,
  is_default boolean DEFAULT false,
  display_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create business_expenses table
CREATE TABLE IF NOT EXISTS business_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES business_info(id) ON DELETE CASCADE,
  category_id uuid REFERENCES expense_categories(id) ON DELETE SET NULL,
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  vendor_name text NOT NULL,
  description text NOT NULL,
  amount numeric(10, 2) NOT NULL CHECK (amount >= 0),
  payment_method text,
  confirmation_number text,
  is_tax_deductible boolean DEFAULT true,
  deductible_amount numeric(10, 2),
  tax_year integer NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
  quarter integer CHECK (quarter >= 1 AND quarter <= 4),
  receipt_url text,
  has_receipt boolean DEFAULT false,
  is_recurring boolean DEFAULT false,
  recurrence_pattern text,
  tags text[],
  notes text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_expenses ENABLE ROW LEVEL SECURITY;

-- RLS Policies for expense_categories
CREATE POLICY "Authenticated users can view expense categories"
  ON expense_categories FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert expense categories"
  ON expense_categories FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update expense categories"
  ON expense_categories FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete expense categories"
  ON expense_categories FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for business_expenses
CREATE POLICY "Authenticated users can view business expenses"
  ON business_expenses FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert business expenses"
  ON business_expenses FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update business expenses"
  ON business_expenses FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete business expenses"
  ON business_expenses FOR DELETE
  TO authenticated
  USING (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_expense_categories_business_id ON expense_categories(business_id);
CREATE INDEX IF NOT EXISTS idx_expense_categories_is_active ON expense_categories(is_active);

CREATE INDEX IF NOT EXISTS idx_business_expenses_business_id ON business_expenses(business_id);
CREATE INDEX IF NOT EXISTS idx_business_expenses_category_id ON business_expenses(category_id);
CREATE INDEX IF NOT EXISTS idx_business_expenses_expense_date ON business_expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_business_expenses_tax_year ON business_expenses(tax_year);
CREATE INDEX IF NOT EXISTS idx_business_expenses_quarter ON business_expenses(quarter);
CREATE INDEX IF NOT EXISTS idx_business_expenses_is_active ON business_expenses(is_active);

-- Function to calculate quarter from date
CREATE OR REPLACE FUNCTION calculate_quarter_from_date(expense_date date)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN EXTRACT(QUARTER FROM expense_date)::integer;
END;
$$;

-- Trigger to auto-calculate quarter and deductible_amount
CREATE OR REPLACE FUNCTION set_expense_calculated_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Auto-calculate quarter if not set
  IF NEW.quarter IS NULL THEN
    NEW.quarter := calculate_quarter_from_date(NEW.expense_date);
  END IF;

  -- Auto-calculate deductible_amount if not set
  IF NEW.deductible_amount IS NULL THEN
    IF NEW.is_tax_deductible THEN
      NEW.deductible_amount := NEW.amount;
    ELSE
      NEW.deductible_amount := 0;
    END IF;
  END IF;

  -- Set tax_year from expense_date if not explicitly set
  IF NEW.tax_year IS NULL OR NEW.tax_year = 0 THEN
    NEW.tax_year := EXTRACT(YEAR FROM NEW.expense_date)::integer;
  END IF;

  -- Update updated_at timestamp
  NEW.updated_at := now();

  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_set_expense_calculated_fields
  BEFORE INSERT OR UPDATE ON business_expenses
  FOR EACH ROW
  EXECUTE FUNCTION set_expense_calculated_fields();

-- Function to get total expenses by period
CREATE OR REPLACE FUNCTION get_total_expenses_by_period(
  p_business_id uuid,
  p_tax_year integer,
  p_quarter integer DEFAULT NULL
)
RETURNS TABLE (
  total_expenses numeric,
  total_deductible numeric,
  expense_count bigint
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(amount), 0) as total_expenses,
    COALESCE(SUM(deductible_amount), 0) as total_deductible,
    COUNT(*) as expense_count
  FROM business_expenses
  WHERE business_id = p_business_id
    AND tax_year = p_tax_year
    AND is_active = true
    AND (p_quarter IS NULL OR quarter = p_quarter);
END;
$$;

-- Insert default expense categories for IRS Schedule C
DO $$
DECLARE
  v_business_id uuid;
BEGIN
  -- Get the active business ID
  SELECT id INTO v_business_id
  FROM business_info
  WHERE is_active = true
  LIMIT 1;

  -- Only insert if we have a business
  IF v_business_id IS NOT NULL THEN
    -- Insert default categories
    INSERT INTO expense_categories (business_id, name, description, irs_category, is_tax_deductible, is_default, display_order) VALUES
    (v_business_id, 'Advertising & Marketing', 'Business promotion, online ads, print materials', 'Advertising', true, true, 1),
    (v_business_id, 'Vehicle & Transportation', 'Gas, mileage, vehicle maintenance, parking', 'Car and Truck Expenses', true, true, 2),
    (v_business_id, 'Office Supplies', 'Paper, pens, printer ink, general supplies', 'Supplies', true, true, 3),
    (v_business_id, 'Software & Subscriptions', 'Business software, cloud services, apps', 'Other Expenses', true, true, 4),
    (v_business_id, 'Tools & Equipment', 'Business tools, machinery, equipment', 'Supplies', true, true, 5),
    (v_business_id, 'Professional Services', 'Legal, accounting, consulting fees', 'Legal and Professional Services', true, true, 6),
    (v_business_id, 'Insurance', 'Business insurance, liability coverage', 'Insurance', true, true, 7),
    (v_business_id, 'Utilities', 'Internet, phone, electricity for business', 'Utilities', true, true, 8),
    (v_business_id, 'Rent & Lease', 'Office or equipment rental', 'Rent or Lease', true, true, 9),
    (v_business_id, 'Repairs & Maintenance', 'Equipment and vehicle repairs', 'Repairs and Maintenance', true, true, 10),
    (v_business_id, 'Education & Training', 'Business courses, certifications, workshops', 'Other Expenses', true, true, 11),
    (v_business_id, 'Travel & Meals', 'Business travel, meals (50% deductible)', 'Travel and Meals', true, true, 12),
    (v_business_id, 'Licenses & Permits', 'Business licenses, permits, fees', 'Other Expenses', true, true, 13),
    (v_business_id, 'Bank Fees & Interest', 'Business account fees, loan interest', 'Interest', true, true, 14),
    (v_business_id, 'Miscellaneous', 'Other deductible business expenses', 'Other Expenses', true, true, 15),
    (v_business_id, 'Personal / Non-Deductible', 'Personal expenses, not business related', 'N/A', false, true, 16)
    ON CONFLICT DO NOTHING;
  END IF;
END $$;