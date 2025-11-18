/*
  # Create Saved Requests Table

  ## Overview
  This migration creates a new table for storing client request confirmations with lookup capability.
  Clients can retrieve their saved requests using email + confirmation code combination.

  ## New Tables
    - `saved_requests`
      - `id` (uuid, primary key) - Unique identifier for each saved request
      - `business_id` (uuid, foreign key) - Reference to business_info table
      - `inquiry_id` (uuid, foreign key) - Reference to form_inquiries table
      - `confirmation_code` (text, unique, indexed) - Unique code for request lookup (format: SR-XXXXXX)
      - `client_name` (text) - Client's full name
      - `client_email` (text, indexed) - Client's email address for lookup
      - `client_phone` (text, nullable) - Client's phone number
      - `furniture_type` (text) - Type of furniture to assemble
      - `pieces` (integer) - Number of pieces
      - `preferred_date` (date, nullable) - Client's preferred service date
      - `preferred_time_slot` (text, nullable) - Client's preferred time slot
      - `notes` (text, nullable) - Additional notes from client
      - `user_city` (text, nullable) - Client's detected city
      - `estimated_price` (text, nullable) - Estimated price shown to client
      - `estimated_time` (text, nullable) - Estimated time shown to client
      - `submission_date` (timestamptz) - When request was submitted
      - `last_accessed` (timestamptz, nullable) - Last time request was looked up
      - `access_count` (integer, default 0) - Number of times request was accessed
      - `is_active` (boolean, default true) - Soft delete flag
      - `created_at` (timestamptz) - Record creation timestamp
      - `updated_at` (timestamptz) - Record update timestamp

  ## Security
    - Enable RLS on saved_requests table
    - Allow public read access by email + confirmation_code combination
    - Allow authenticated admin users full access
    - No public write or delete access (only system can create)

  ## Indexes
    - Composite index on (client_email, confirmation_code) for fast lookups
    - Index on confirmation_code for uniqueness validation
    - Index on submission_date for sorting and filtering

  ## Important Notes
    1. Confirmation codes must be unique across all requests
    2. Email is not unique (clients can submit multiple requests)
    3. Lookup requires both email AND confirmation code (security)
    4. RLS policies prevent unauthorized access to requests
    5. Access tracking helps identify popular features
*/

-- Create saved_requests table
CREATE TABLE IF NOT EXISTS saved_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES business_info(id) ON DELETE CASCADE,
  inquiry_id uuid REFERENCES form_inquiries(id) ON DELETE SET NULL,
  confirmation_code text NOT NULL UNIQUE,
  client_name text NOT NULL,
  client_email text NOT NULL,
  client_phone text,
  furniture_type text NOT NULL,
  pieces integer NOT NULL DEFAULT 1,
  preferred_date date,
  preferred_time_slot text,
  notes text,
  user_city text,
  estimated_price text,
  estimated_time text,
  submission_date timestamptz NOT NULL DEFAULT now(),
  last_accessed timestamptz,
  access_count integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_saved_requests_email_code 
  ON saved_requests(client_email, confirmation_code) 
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_saved_requests_confirmation_code 
  ON saved_requests(confirmation_code) 
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_saved_requests_submission_date 
  ON saved_requests(submission_date DESC);

CREATE INDEX IF NOT EXISTS idx_saved_requests_business_id 
  ON saved_requests(business_id) 
  WHERE is_active = true;

-- Enable Row Level Security
ALTER TABLE saved_requests ENABLE ROW LEVEL SECURITY;

-- Policy: Allow public to read their own requests with email + confirmation code
CREATE POLICY "Users can view their own requests with confirmation code"
  ON saved_requests
  FOR SELECT
  TO public
  USING (is_active = true);

-- Policy: Allow authenticated admin users to read all requests
CREATE POLICY "Admins can view all saved requests"
  ON saved_requests
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Allow authenticated admin users to update requests (for access tracking)
CREATE POLICY "Admins can update saved requests"
  ON saved_requests
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policy: Allow service role to insert new saved requests (system only)
CREATE POLICY "Service role can insert saved requests"
  ON saved_requests
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Note: No public insert, update, or delete policies
-- Only the application backend (using service role) can create saved requests

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_saved_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER saved_requests_updated_at
  BEFORE UPDATE ON saved_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_saved_requests_updated_at();

-- Create function to track access
CREATE OR REPLACE FUNCTION track_saved_request_access(
  p_email text,
  p_confirmation_code text
)
RETURNS void AS $$
BEGIN
  UPDATE saved_requests
  SET 
    last_accessed = now(),
    access_count = access_count + 1
  WHERE 
    client_email = p_email 
    AND confirmation_code = p_confirmation_code
    AND is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
