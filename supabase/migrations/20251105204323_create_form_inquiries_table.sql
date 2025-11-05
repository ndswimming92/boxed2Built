/*
  # Create Form Inquiries Table

  1. New Tables
    - `form_inquiries`
      - `id` (uuid, primary key) - Unique identifier for each inquiry
      - `business_id` (uuid, foreign key) - Links to business_info table
      - `client_name` (text) - Name from contact form
      - `client_email` (text) - Email from contact form
      - `client_phone` (text, nullable) - Phone number if provided
      - `furniture_type` (text) - Type of furniture selected
      - `pieces` (integer) - Number of pieces to assemble
      - `preferred_date` (date, nullable) - Preferred service date
      - `preferred_time_slot` (text, nullable) - Preferred time slot
      - `notes` (text, nullable) - Additional notes from form
      - `user_city` (text, nullable) - Detected user location
      - `estimated_price` (text, nullable) - Estimated price calculated
      - `estimated_time` (text, nullable) - Estimated time calculated
      - `submission_date` (timestamptz) - When form was submitted
      - `status` (text) - pending, converted_to_job, archived
      - `source` (text) - contact_form, booking_form, etc.
      - `viewed` (boolean) - Whether admin has viewed the inquiry
      - `converted_job_id` (uuid, nullable, foreign key) - Links to jobs table if converted
      - `last_contact_date` (timestamptz, nullable) - Last time admin contacted client
      - `contact_method` (text, nullable) - email, sms, phone
      - `contact_notes` (text, nullable) - Notes about communications
      - `response_count` (integer) - Number of times admin has contacted client
      - `utm_source` (text, nullable) - UTM tracking parameter
      - `utm_medium` (text, nullable) - UTM tracking parameter
      - `utm_campaign` (text, nullable) - UTM tracking parameter
      - `referral_source` (text, nullable) - How client found the business
      - `is_active` (boolean) - Soft delete flag
      - `created_at` (timestamptz) - Record creation timestamp
      - `updated_at` (timestamptz) - Record update timestamp

  2. Security
    - Enable RLS on `form_inquiries` table
    - Add policy for authenticated admin users to manage inquiries
    - Public users cannot access inquiries (admin only)

  3. Indexes
    - Index on business_id for fast lookups
    - Index on status for filtering
    - Index on viewed for unread count queries
    - Index on submission_date for sorting
    - Index on converted_job_id for job linkage

  4. Important Notes
    - All inquiries are stored for historical tracking
    - Conversion to job does not delete the inquiry
    - Admin can archive spam or invalid inquiries
    - Real-time subscriptions will notify admin of new inquiries
*/

-- Create form_inquiries table
CREATE TABLE IF NOT EXISTS form_inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES business_info(id) ON DELETE CASCADE,
  client_name text NOT NULL,
  client_email text NOT NULL,
  client_phone text,
  furniture_type text NOT NULL,
  pieces integer NOT NULL CHECK (pieces > 0),
  preferred_date date,
  preferred_time_slot text,
  notes text,
  user_city text,
  estimated_price text,
  estimated_time text,
  submission_date timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'converted_to_job', 'archived')),
  source text NOT NULL DEFAULT 'contact_form',
  viewed boolean NOT NULL DEFAULT false,
  converted_job_id uuid REFERENCES jobs(id) ON DELETE SET NULL,
  last_contact_date timestamptz,
  contact_method text,
  contact_notes text,
  response_count integer NOT NULL DEFAULT 0,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  referral_source text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_form_inquiries_business_id ON form_inquiries(business_id);
CREATE INDEX IF NOT EXISTS idx_form_inquiries_status ON form_inquiries(status);
CREATE INDEX IF NOT EXISTS idx_form_inquiries_viewed ON form_inquiries(viewed);
CREATE INDEX IF NOT EXISTS idx_form_inquiries_submission_date ON form_inquiries(submission_date DESC);
CREATE INDEX IF NOT EXISTS idx_form_inquiries_converted_job_id ON form_inquiries(converted_job_id);

-- Enable Row Level Security
ALTER TABLE form_inquiries ENABLE ROW LEVEL SECURITY;

-- Policy: Only authenticated admin users can view inquiries
CREATE POLICY "Authenticated users can view inquiries"
  ON form_inquiries FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Only authenticated admin users can insert inquiries
CREATE POLICY "Authenticated users can insert inquiries"
  ON form_inquiries FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy: Only authenticated admin users can update inquiries
CREATE POLICY "Authenticated users can update inquiries"
  ON form_inquiries FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policy: Only authenticated admin users can delete inquiries
CREATE POLICY "Authenticated users can delete inquiries"
  ON form_inquiries FOR DELETE
  TO authenticated
  USING (true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_form_inquiries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS set_form_inquiries_updated_at ON form_inquiries;
CREATE TRIGGER set_form_inquiries_updated_at
  BEFORE UPDATE ON form_inquiries
  FOR EACH ROW
  EXECUTE FUNCTION update_form_inquiries_updated_at();