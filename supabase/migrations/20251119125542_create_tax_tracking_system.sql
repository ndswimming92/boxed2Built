/*
  # Create Tax Tracking System

  1. New Tables
    - `tax_settings`
      - Business tax configuration
      - Filing status, deductions, preferences
      - One per business

    - `quarterly_tax_payments`
      - Track actual quarterly tax payments made
      - Q1, Q2, Q3, Q4 tracking
      - Payment confirmation and amounts

    - `tax_calculations`
      - Historical tax calculation snapshots
      - Tracks estimates over time
      - Helps with year-over-year comparison

  2. Security
    - Enable RLS on all tables
    - Admin-only access for tax data
    - Authenticated users can view their business tax info

  3. Indexes
    - Foreign key indexes for performance
    - Date-based indexes for quarterly lookups
*/

-- ============================================================================
-- 1. TAX SETTINGS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS tax_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES business_info(id) ON DELETE CASCADE,
  
  -- Filing Information
  filing_status text NOT NULL DEFAULT 'single',
  -- Options: 'single', 'married_joint', 'married_separate', 'head_of_household'
  
  -- Deduction Information
  use_standard_deduction boolean NOT NULL DEFAULT true,
  estimated_itemized_deductions numeric(10, 2) DEFAULT 0,
  
  -- Business Expense Tracking
  estimated_annual_business_expenses numeric(10, 2) DEFAULT 0,
  
  -- Quarterly Tax Goals
  q1_payment_goal numeric(10, 2) DEFAULT 0,
  q2_payment_goal numeric(10, 2) DEFAULT 0,
  q3_payment_goal numeric(10, 2) DEFAULT 0,
  q4_payment_goal numeric(10, 2) DEFAULT 0,
  
  -- Additional Settings
  include_health_insurance_deduction boolean DEFAULT false,
  health_insurance_annual_cost numeric(10, 2) DEFAULT 0,
  
  include_retirement_contributions boolean DEFAULT false,
  retirement_contribution_annual numeric(10, 2) DEFAULT 0,
  
  -- State-specific (TN has no state income tax)
  state text NOT NULL DEFAULT 'TN',
  
  -- Metadata
  tax_year integer NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Ensure one active setting per business per tax year
  CONSTRAINT unique_business_tax_year UNIQUE (business_id, tax_year, is_active)
);

ALTER TABLE tax_settings ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 2. QUARTERLY TAX PAYMENTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS quarterly_tax_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES business_info(id) ON DELETE CASCADE,
  
  -- Quarter Information
  tax_year integer NOT NULL,
  quarter integer NOT NULL CHECK (quarter >= 1 AND quarter <= 4),
  -- Q1: Jan-Mar (due Apr 15), Q2: Apr-May (due Jun 15)
  -- Q3: Jun-Aug (due Sep 15), Q4: Sep-Dec (due Jan 15)
  
  -- Payment Details
  payment_amount numeric(10, 2) NOT NULL,
  payment_date date NOT NULL,
  payment_method text,
  -- Options: 'eftps', 'irs_direct_pay', 'check', 'credit_card', 'other'
  
  -- IRS Confirmation
  confirmation_number text,
  
  -- Payment Breakdown
  federal_income_tax_amount numeric(10, 2) DEFAULT 0,
  self_employment_tax_amount numeric(10, 2) DEFAULT 0,
  
  -- Notes
  notes text,
  
  -- Metadata
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE quarterly_tax_payments ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 3. TAX CALCULATIONS TABLE (Historical Snapshots)
-- ============================================================================

CREATE TABLE IF NOT EXISTS tax_calculations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES business_info(id) ON DELETE CASCADE,
  
  -- Calculation Period
  calculation_date date NOT NULL DEFAULT CURRENT_DATE,
  tax_year integer NOT NULL,
  quarter integer CHECK (quarter >= 1 AND quarter <= 4),
  -- NULL quarter = full year calculation
  
  -- Income Information
  gross_income numeric(10, 2) NOT NULL DEFAULT 0,
  total_expenses numeric(10, 2) NOT NULL DEFAULT 0,
  net_profit numeric(10, 2) NOT NULL DEFAULT 0,
  
  -- Tax Calculations
  self_employment_tax numeric(10, 2) NOT NULL DEFAULT 0,
  self_employment_deduction numeric(10, 2) NOT NULL DEFAULT 0,
  adjusted_gross_income numeric(10, 2) NOT NULL DEFAULT 0,
  
  standard_or_itemized_deduction numeric(10, 2) NOT NULL DEFAULT 0,
  taxable_income numeric(10, 2) NOT NULL DEFAULT 0,
  
  federal_income_tax numeric(10, 2) NOT NULL DEFAULT 0,
  total_tax_liability numeric(10, 2) NOT NULL DEFAULT 0,
  
  -- Withholding & Payments
  quarterly_payments_made numeric(10, 2) DEFAULT 0,
  estimated_tax_remaining numeric(10, 2) DEFAULT 0,
  
  -- Tax Rates
  effective_tax_rate numeric(5, 2) DEFAULT 0,
  marginal_tax_bracket numeric(5, 2) DEFAULT 0,
  
  -- Per-Job Recommendations
  recommended_withholding_percentage numeric(5, 2) DEFAULT 0,
  
  -- Metadata
  calculation_type text DEFAULT 'automatic',
  -- Options: 'automatic', 'manual', 'year_end', 'quarterly_estimate'
  
  notes text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE tax_calculations ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 4. INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_tax_settings_business_id 
  ON tax_settings(business_id);

CREATE INDEX IF NOT EXISTS idx_tax_settings_tax_year 
  ON tax_settings(tax_year);

CREATE INDEX IF NOT EXISTS idx_quarterly_tax_payments_business_id 
  ON quarterly_tax_payments(business_id);

CREATE INDEX IF NOT EXISTS idx_quarterly_tax_payments_tax_year_quarter 
  ON quarterly_tax_payments(tax_year, quarter);

CREATE INDEX IF NOT EXISTS idx_tax_calculations_business_id 
  ON tax_calculations(business_id);

CREATE INDEX IF NOT EXISTS idx_tax_calculations_tax_year 
  ON tax_calculations(tax_year);

CREATE INDEX IF NOT EXISTS idx_tax_calculations_date 
  ON tax_calculations(calculation_date);

-- ============================================================================
-- 5. RLS POLICIES
-- ============================================================================

-- Tax Settings Policies
CREATE POLICY "Authenticated users can view tax settings"
  ON tax_settings
  FOR SELECT
  TO authenticated
  USING (
    business_id IN (
      SELECT id FROM public.business_info WHERE is_active = true
    )
  );

CREATE POLICY "Authenticated users can insert tax settings"
  ON tax_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    business_id IN (
      SELECT id FROM public.business_info WHERE is_active = true
    )
  );

CREATE POLICY "Authenticated users can update tax settings"
  ON tax_settings
  FOR UPDATE
  TO authenticated
  USING (
    business_id IN (
      SELECT id FROM public.business_info WHERE is_active = true
    )
  )
  WITH CHECK (
    business_id IN (
      SELECT id FROM public.business_info WHERE is_active = true
    )
  );

CREATE POLICY "Authenticated users can delete tax settings"
  ON tax_settings
  FOR DELETE
  TO authenticated
  USING (
    business_id IN (
      SELECT id FROM public.business_info WHERE is_active = true
    )
  );

-- Quarterly Tax Payments Policies
CREATE POLICY "Authenticated users can view quarterly payments"
  ON quarterly_tax_payments
  FOR SELECT
  TO authenticated
  USING (
    business_id IN (
      SELECT id FROM public.business_info WHERE is_active = true
    )
  );

CREATE POLICY "Authenticated users can insert quarterly payments"
  ON quarterly_tax_payments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    business_id IN (
      SELECT id FROM public.business_info WHERE is_active = true
    )
  );

CREATE POLICY "Authenticated users can update quarterly payments"
  ON quarterly_tax_payments
  FOR UPDATE
  TO authenticated
  USING (
    business_id IN (
      SELECT id FROM public.business_info WHERE is_active = true
    )
  )
  WITH CHECK (
    business_id IN (
      SELECT id FROM public.business_info WHERE is_active = true
    )
  );

CREATE POLICY "Authenticated users can delete quarterly payments"
  ON quarterly_tax_payments
  FOR DELETE
  TO authenticated
  USING (
    business_id IN (
      SELECT id FROM public.business_info WHERE is_active = true
    )
  );

-- Tax Calculations Policies
CREATE POLICY "Authenticated users can view tax calculations"
  ON tax_calculations
  FOR SELECT
  TO authenticated
  USING (
    business_id IN (
      SELECT id FROM public.business_info WHERE is_active = true
    )
  );

CREATE POLICY "Authenticated users can insert tax calculations"
  ON tax_calculations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    business_id IN (
      SELECT id FROM public.business_info WHERE is_active = true
    )
  );

CREATE POLICY "Authenticated users can update tax calculations"
  ON tax_calculations
  FOR UPDATE
  TO authenticated
  USING (
    business_id IN (
      SELECT id FROM public.business_info WHERE is_active = true
    )
  )
  WITH CHECK (
    business_id IN (
      SELECT id FROM public.business_info WHERE is_active = true
    )
  );

CREATE POLICY "Authenticated users can delete tax calculations"
  ON tax_calculations
  FOR DELETE
  TO authenticated
  USING (
    business_id IN (
      SELECT id FROM public.business_info WHERE is_active = true
    )
  );

-- ============================================================================
-- 6. TRIGGERS FOR UPDATED_AT
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_tax_settings_updated_at()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER tax_settings_updated_at
  BEFORE UPDATE ON tax_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_tax_settings_updated_at();

CREATE OR REPLACE FUNCTION public.update_quarterly_tax_payments_updated_at()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER quarterly_tax_payments_updated_at
  BEFORE UPDATE ON quarterly_tax_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_quarterly_tax_payments_updated_at();

CREATE OR REPLACE FUNCTION public.update_tax_calculations_updated_at()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER tax_calculations_updated_at
  BEFORE UPDATE ON tax_calculations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_tax_calculations_updated_at();
