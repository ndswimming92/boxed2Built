/*
  # Create Revenue Forecasting Tables

  ## Overview
  This migration creates tables to support revenue forecasting functionality in the admin portal.
  It allows storing forecast predictions, configurations, and historical accuracy tracking.

  ## New Tables

  ### 1. `revenue_forecasts`
  Stores individual forecast data points for future revenue predictions.

  **Columns:**
  - `id` (uuid, primary key) - Unique identifier for each forecast record
  - `business_id` (uuid, foreign key) - Links to business_info table
  - `forecast_date` (date, required) - The date this forecast is for
  - `predicted_revenue` (numeric) - Predicted revenue amount for the forecast date
  - `predicted_job_count` (integer) - Predicted number of jobs for the forecast date
  - `confidence_lower` (numeric) - Lower bound of confidence interval
  - `confidence_upper` (numeric) - Upper bound of confidence interval
  - `confidence_level` (numeric) - Confidence percentage (e.g., 95 for 95%)
  - `model_type` (text) - Algorithm used (linear, exponential, seasonal, ensemble)
  - `model_parameters` (jsonb) - Stores model configuration as JSON
  - `generated_at` (timestamptz) - When this forecast was generated
  - `is_active` (boolean, default true) - Soft delete flag
  - `created_at` (timestamptz) - Record creation timestamp
  - `updated_at` (timestamptz) - Record update timestamp

  ### 2. `forecast_settings`
  Stores user preferences and configuration for forecast generation.

  **Columns:**
  - `id` (uuid, primary key) - Unique identifier
  - `business_id` (uuid, foreign key) - Links to business_info table
  - `forecast_months` (integer, default 12) - How many months to forecast ahead
  - `growth_rate_override` (numeric) - Manual growth rate percentage adjustment
  - `seasonality_enabled` (boolean, default true) - Whether to apply seasonal adjustments
  - `model_preference` (text, default 'auto') - Preferred model: auto, linear, exponential, seasonal, ensemble
  - `confidence_level` (numeric, default 95) - Confidence level for intervals (e.g., 95%)
  - `last_generated_at` (timestamptz) - Last time forecasts were generated
  - `is_active` (boolean, default true) - Soft delete flag
  - `created_at` (timestamptz) - Record creation timestamp
  - `updated_at` (timestamptz) - Record update timestamp

  ### 3. `forecast_accuracy`
  Tracks how accurate past forecasts were compared to actual results.

  **Columns:**
  - `id` (uuid, primary key) - Unique identifier
  - `business_id` (uuid, foreign key) - Links to business_info table
  - `forecast_date` (date) - The date that was forecasted
  - `predicted_revenue` (numeric) - What was predicted
  - `actual_revenue` (numeric) - What actually happened
  - `accuracy_percent` (numeric) - Calculated accuracy percentage
  - `model_type` (text) - Which model made this prediction
  - `is_active` (boolean, default true) - Soft delete flag
  - `created_at` (timestamptz) - Record creation timestamp

  ## Security
  - Enable RLS on all tables
  - Only authenticated users can access forecast data
  - All operations (SELECT, INSERT, UPDATE, DELETE) restricted to authenticated users

  ## Indexes
  - Index on business_id for all tables
  - Index on forecast_date for efficient date-based queries
  - Composite index on (business_id, forecast_date) for common queries

  ## Important Notes
  - Forecasts are recalculated based on settings, not meant to be manually edited
  - Historical accuracy data helps improve future predictions
  - Model parameters stored as JSONB for flexibility
  - Confidence intervals provide range of possible outcomes
*/

CREATE TABLE IF NOT EXISTS revenue_forecasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES business_info(id) ON DELETE CASCADE,
  forecast_date date NOT NULL,
  predicted_revenue numeric(10, 2) NOT NULL DEFAULT 0,
  predicted_job_count integer DEFAULT 0,
  confidence_lower numeric(10, 2) DEFAULT 0,
  confidence_upper numeric(10, 2) DEFAULT 0,
  confidence_level numeric(5, 2) DEFAULT 95.0,
  model_type text DEFAULT 'ensemble',
  model_parameters jsonb DEFAULT '{}',
  generated_at timestamptz DEFAULT now(),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT unique_business_forecast_date UNIQUE (business_id, forecast_date, model_type)
);

CREATE TABLE IF NOT EXISTS forecast_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES business_info(id) ON DELETE CASCADE,
  forecast_months integer DEFAULT 12,
  growth_rate_override numeric(5, 2),
  seasonality_enabled boolean DEFAULT true,
  model_preference text DEFAULT 'auto',
  confidence_level numeric(5, 2) DEFAULT 95.0,
  last_generated_at timestamptz,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT unique_business_settings UNIQUE (business_id)
);

CREATE TABLE IF NOT EXISTS forecast_accuracy (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES business_info(id) ON DELETE CASCADE,
  forecast_date date NOT NULL,
  predicted_revenue numeric(10, 2) NOT NULL,
  actual_revenue numeric(10, 2) NOT NULL,
  accuracy_percent numeric(5, 2),
  model_type text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE revenue_forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE forecast_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE forecast_accuracy ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read revenue forecasts"
  ON revenue_forecasts
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert revenue forecasts"
  ON revenue_forecasts
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update revenue forecasts"
  ON revenue_forecasts
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete revenue forecasts"
  ON revenue_forecasts
  FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can read forecast settings"
  ON forecast_settings
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert forecast settings"
  ON forecast_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update forecast settings"
  ON forecast_settings
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete forecast settings"
  ON forecast_settings
  FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can read forecast accuracy"
  ON forecast_accuracy
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert forecast accuracy"
  ON forecast_accuracy
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update forecast accuracy"
  ON forecast_accuracy
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete forecast accuracy"
  ON forecast_accuracy
  FOR DELETE
  TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_revenue_forecasts_business_id ON revenue_forecasts(business_id);
CREATE INDEX IF NOT EXISTS idx_revenue_forecasts_forecast_date ON revenue_forecasts(forecast_date);
CREATE INDEX IF NOT EXISTS idx_revenue_forecasts_business_date ON revenue_forecasts(business_id, forecast_date);

CREATE INDEX IF NOT EXISTS idx_forecast_settings_business_id ON forecast_settings(business_id);

CREATE INDEX IF NOT EXISTS idx_forecast_accuracy_business_id ON forecast_accuracy(business_id);
CREATE INDEX IF NOT EXISTS idx_forecast_accuracy_forecast_date ON forecast_accuracy(forecast_date);

CREATE OR REPLACE FUNCTION update_revenue_forecasts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_forecast_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER revenue_forecasts_updated_at
  BEFORE UPDATE ON revenue_forecasts
  FOR EACH ROW
  EXECUTE FUNCTION update_revenue_forecasts_updated_at();

CREATE TRIGGER forecast_settings_updated_at
  BEFORE UPDATE ON forecast_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_forecast_settings_updated_at();