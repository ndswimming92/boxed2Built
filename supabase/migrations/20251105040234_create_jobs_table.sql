/*
  # Create Jobs Table

  1. New Tables
    - `jobs`
      - `id` (uuid, primary key)
      - `business_id` (uuid, foreign key to business_info)
      - `client_name` (text, required) - Name of the client
      - `client_phone` (text) - Client phone number
      - `client_email` (text) - Client email address
      - `job_type` (text) - Type of job (e.g., Furniture Assembly, Curtain Installation)
      - `job_description` (text) - Detailed description of the job
      - `date_quoted` (date) - Date when the quote was provided
      - `date_scheduled` (date) - Date when the job is scheduled
      - `date_completed` (date) - Date when the job was completed
      - `hours_worked` (numeric) - Number of hours worked on the job
      - `quoted_price` (numeric) - Initial quoted price
      - `final_price` (numeric) - Final price charged
      - `materials_cost` (numeric) - Cost of materials and extras
      - `location_city` (text) - City where the job was performed
      - `payment_method` (text) - Method of payment used
      - `payment_date` (date) - Date when payment was received
      - `reviews_received` (boolean, default false) - Whether reviews were received
      - `google_review_link_sent` (boolean, default false) - Whether Google review link was sent
      - `repeat_client` (boolean, default false) - Whether client is a repeat customer
      - `referral_source` (text) - How the client found the business
      - `notes` (text) - Additional notes about the job
      - `is_active` (boolean, default true) - Soft delete flag
      - `created_at` (timestamptz) - Record creation timestamp
      - `updated_at` (timestamptz) - Record update timestamp

  2. Security
    - Enable RLS on `jobs` table
    - Add policy for authenticated users to read all jobs
    - Add policy for authenticated users to insert jobs
    - Add policy for authenticated users to update jobs
    - Add policy for authenticated users to delete jobs

  3. Indexes
    - Create index on business_id for efficient filtering
    - Create index on date_completed for sorting and filtering
    - Create index on location_city for location-based queries
*/

CREATE TABLE IF NOT EXISTS jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES business_info(id) ON DELETE CASCADE,
  client_name text NOT NULL,
  client_phone text,
  client_email text,
  job_type text,
  job_description text,
  date_quoted date,
  date_scheduled date,
  date_completed date,
  hours_worked numeric(10, 2),
  quoted_price numeric(10, 2),
  final_price numeric(10, 2),
  materials_cost numeric(10, 2) DEFAULT 0,
  location_city text,
  payment_method text,
  payment_date date,
  reviews_received boolean DEFAULT false,
  google_review_link_sent boolean DEFAULT false,
  repeat_client boolean DEFAULT false,
  referral_source text,
  notes text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read all jobs"
  ON jobs
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert jobs"
  ON jobs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update jobs"
  ON jobs
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete jobs"
  ON jobs
  FOR DELETE
  TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_jobs_business_id ON jobs(business_id);
CREATE INDEX IF NOT EXISTS idx_jobs_date_completed ON jobs(date_completed);
CREATE INDEX IF NOT EXISTS idx_jobs_location_city ON jobs(location_city);

CREATE OR REPLACE FUNCTION update_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER jobs_updated_at
  BEFORE UPDATE ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_jobs_updated_at();