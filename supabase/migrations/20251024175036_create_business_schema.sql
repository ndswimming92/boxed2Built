/*
  # Business Information Schema for Local SEO and Google Search Console

  ## Overview
  This migration creates a comprehensive database schema to store business information
  for enhanced Google Search Console integration and local business structured data.

  ## New Tables Created

  ### 1. business_info
  - `id` (uuid, primary key) - Unique identifier
  - `name` (text) - Business name
  - `alternate_name` (text) - Alternative business name
  - `description` (text) - Business description
  - `slogan` (text) - Business slogan
  - `phone` (text) - Primary phone number
  - `email` (text) - Primary email address
  - `website` (text) - Website URL
  - `founded_year` (text) - Year business was founded
  - `founder_name` (text) - Founder's name
  - `price_range` (text) - Price range indicator
  - `currencies_accepted` (text) - Accepted currencies
  - `logo_url` (text) - Logo image URL
  - `image_url` (text) - Primary business image URL
  - `is_active` (boolean) - Whether this record is active
  - `created_at` (timestamptz) - Record creation timestamp
  - `updated_at` (timestamptz) - Record last update timestamp

  ### 2. business_address
  - `id` (uuid, primary key) - Unique identifier
  - `business_id` (uuid, foreign key) - Reference to business_info
  - `street_address` (text) - Street address (optional for service businesses)
  - `address_locality` (text) - City name
  - `address_region` (text) - State/region code
  - `postal_code` (text) - ZIP/postal code
  - `address_country` (text) - Country code
  - `latitude` (numeric) - Geographic latitude
  - `longitude` (numeric) - Geographic longitude
  - `created_at` (timestamptz) - Record creation timestamp
  - `updated_at` (timestamptz) - Record last update timestamp

  ### 3. service_areas
  - `id` (uuid, primary key) - Unique identifier
  - `business_id` (uuid, foreign key) - Reference to business_info
  - `city_name` (text) - Service area city name
  - `region` (text) - State/region code
  - `country` (text) - Country code
  - `postal_codes` (text[]) - Array of postal codes covered
  - `latitude` (numeric) - City center latitude
  - `longitude` (numeric) - City center longitude
  - `radius_miles` (integer) - Service radius in miles
  - `priority` (integer) - Display priority order
  - `is_active` (boolean) - Whether this service area is active
  - `created_at` (timestamptz) - Record creation timestamp
  - `updated_at` (timestamptz) - Record last update timestamp

  ### 4. services
  - `id` (uuid, primary key) - Unique identifier
  - `business_id` (uuid, foreign key) - Reference to business_info
  - `name` (text) - Service name
  - `description` (text) - Service description
  - `category` (text) - Service category
  - `base_price` (numeric) - Base price for service
  - `price_currency` (text) - Currency code
  - `duration_minutes` (integer) - Estimated duration
  - `is_featured` (boolean) - Featured service flag
  - `display_order` (integer) - Display order
  - `is_active` (boolean) - Whether service is active
  - `created_at` (timestamptz) - Record creation timestamp
  - `updated_at` (timestamptz) - Record last update timestamp

  ### 5. business_hours
  - `id` (uuid, primary key) - Unique identifier
  - `business_id` (uuid, foreign key) - Reference to business_info
  - `day_of_week` (text) - Day name (Monday-Sunday)
  - `opens` (time) - Opening time
  - `closes` (time) - Closing time
  - `is_closed` (boolean) - Whether business is closed this day
  - `created_at` (timestamptz) - Record creation timestamp
  - `updated_at` (timestamptz) - Record last update timestamp

  ### 6. payment_methods
  - `id` (uuid, primary key) - Unique identifier
  - `business_id` (uuid, foreign key) - Reference to business_info
  - `method_name` (text) - Payment method name
  - `is_active` (boolean) - Whether method is accepted
  - `display_order` (integer) - Display order
  - `created_at` (timestamptz) - Record creation timestamp

  ### 7. social_media
  - `id` (uuid, primary key) - Unique identifier
  - `business_id` (uuid, foreign key) - Reference to business_info
  - `platform` (text) - Social media platform name
  - `profile_url` (text) - Full profile URL
  - `is_active` (boolean) - Whether profile is active
  - `display_order` (integer) - Display order
  - `created_at` (timestamptz) - Record creation timestamp

  ### 8. customer_reviews
  - `id` (uuid, primary key) - Unique identifier
  - `business_id` (uuid, foreign key) - Reference to business_info
  - `author_name` (text) - Review author name
  - `review_body` (text) - Review content
  - `rating_value` (integer) - Rating (1-5)
  - `date_published` (date) - Review publication date
  - `is_featured` (boolean) - Featured review flag
  - `is_verified` (boolean) - Verified customer flag
  - `is_active` (boolean) - Whether review is active/visible
  - `created_at` (timestamptz) - Record creation timestamp
  - `updated_at` (timestamptz) - Record last update timestamp

  ### 9. business_attributes
  - `id` (uuid, primary key) - Unique identifier
  - `business_id` (uuid, foreign key) - Reference to business_info
  - `attribute_name` (text) - Attribute name
  - `attribute_value` (text) - Attribute value
  - `created_at` (timestamptz) - Record creation timestamp

  ## Security Implementation
  - Row Level Security (RLS) is enabled on all tables
  - Public read access for displaying business information
  - Authenticated users only can modify data
  - Service role has full access for administrative operations

  ## Indexes
  - Foreign key indexes for performance
  - Query optimization indexes on frequently accessed columns
  - Composite indexes for common query patterns

  ## Notes
  - All timestamps use timestamptz for timezone awareness
  - Boolean flags for easy filtering of active/inactive records
  - Flexible schema supports multiple businesses (future expansion)
  - Designed for optimal Google Search Console structured data generation
*/

-- Create business_info table
CREATE TABLE IF NOT EXISTS business_info (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  alternate_name text,
  description text NOT NULL,
  slogan text,
  phone text NOT NULL,
  email text NOT NULL,
  website text NOT NULL,
  founded_year text,
  founder_name text,
  price_range text,
  currencies_accepted text DEFAULT 'USD',
  logo_url text,
  image_url text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create business_address table
CREATE TABLE IF NOT EXISTS business_address (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES business_info(id) ON DELETE CASCADE,
  street_address text DEFAULT '',
  address_locality text NOT NULL,
  address_region text NOT NULL,
  postal_code text,
  address_country text NOT NULL DEFAULT 'US',
  latitude numeric(10, 7),
  longitude numeric(10, 7),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create service_areas table
CREATE TABLE IF NOT EXISTS service_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES business_info(id) ON DELETE CASCADE,
  city_name text NOT NULL,
  region text NOT NULL,
  country text NOT NULL DEFAULT 'US',
  postal_codes text[],
  latitude numeric(10, 7),
  longitude numeric(10, 7),
  radius_miles integer DEFAULT 10,
  priority integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create services table
CREATE TABLE IF NOT EXISTS services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES business_info(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NOT NULL,
  category text,
  base_price numeric(10, 2) NOT NULL,
  price_currency text DEFAULT 'USD',
  duration_minutes integer,
  is_featured boolean DEFAULT false,
  display_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create business_hours table
CREATE TABLE IF NOT EXISTS business_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES business_info(id) ON DELETE CASCADE,
  day_of_week text NOT NULL CHECK (day_of_week IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday')),
  opens time,
  closes time,
  is_closed boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(business_id, day_of_week)
);

-- Create payment_methods table
CREATE TABLE IF NOT EXISTS payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES business_info(id) ON DELETE CASCADE,
  method_name text NOT NULL,
  is_active boolean DEFAULT true,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Create social_media table
CREATE TABLE IF NOT EXISTS social_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES business_info(id) ON DELETE CASCADE,
  platform text NOT NULL,
  profile_url text NOT NULL,
  is_active boolean DEFAULT true,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Create customer_reviews table
CREATE TABLE IF NOT EXISTS customer_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES business_info(id) ON DELETE CASCADE,
  author_name text NOT NULL,
  review_body text NOT NULL,
  rating_value integer NOT NULL CHECK (rating_value >= 1 AND rating_value <= 5),
  date_published date NOT NULL,
  is_featured boolean DEFAULT false,
  is_verified boolean DEFAULT false,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create business_attributes table
CREATE TABLE IF NOT EXISTS business_attributes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES business_info(id) ON DELETE CASCADE,
  attribute_name text NOT NULL,
  attribute_value text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_business_address_business_id ON business_address(business_id);
CREATE INDEX IF NOT EXISTS idx_service_areas_business_id ON service_areas(business_id);
CREATE INDEX IF NOT EXISTS idx_service_areas_active ON service_areas(business_id, is_active);
CREATE INDEX IF NOT EXISTS idx_services_business_id ON services(business_id);
CREATE INDEX IF NOT EXISTS idx_services_active ON services(business_id, is_active);
CREATE INDEX IF NOT EXISTS idx_services_featured ON services(business_id, is_featured, is_active);
CREATE INDEX IF NOT EXISTS idx_business_hours_business_id ON business_hours(business_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_business_id ON payment_methods(business_id);
CREATE INDEX IF NOT EXISTS idx_social_media_business_id ON social_media(business_id);
CREATE INDEX IF NOT EXISTS idx_customer_reviews_business_id ON customer_reviews(business_id);
CREATE INDEX IF NOT EXISTS idx_customer_reviews_active ON customer_reviews(business_id, is_active);
CREATE INDEX IF NOT EXISTS idx_customer_reviews_featured ON customer_reviews(business_id, is_featured, is_active);
CREATE INDEX IF NOT EXISTS idx_business_attributes_business_id ON business_attributes(business_id);

-- Enable Row Level Security
ALTER TABLE business_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_address ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_attributes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for business_info
CREATE POLICY "Public can view active business info"
  ON business_info FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

CREATE POLICY "Authenticated users can update business info"
  ON business_info FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can insert business info"
  ON business_info FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- RLS Policies for business_address
CREATE POLICY "Public can view business addresses"
  ON business_address FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM business_info
      WHERE business_info.id = business_address.business_id
      AND business_info.is_active = true
    )
  );

CREATE POLICY "Authenticated users can manage business addresses"
  ON business_address FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- RLS Policies for service_areas
CREATE POLICY "Public can view active service areas"
  ON service_areas FOR SELECT
  TO anon, authenticated
  USING (
    is_active = true AND
    EXISTS (
      SELECT 1 FROM business_info
      WHERE business_info.id = service_areas.business_id
      AND business_info.is_active = true
    )
  );

CREATE POLICY "Authenticated users can manage service areas"
  ON service_areas FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- RLS Policies for services
CREATE POLICY "Public can view active services"
  ON services FOR SELECT
  TO anon, authenticated
  USING (
    is_active = true AND
    EXISTS (
      SELECT 1 FROM business_info
      WHERE business_info.id = services.business_id
      AND business_info.is_active = true
    )
  );

CREATE POLICY "Authenticated users can manage services"
  ON services FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- RLS Policies for business_hours
CREATE POLICY "Public can view business hours"
  ON business_hours FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM business_info
      WHERE business_info.id = business_hours.business_id
      AND business_info.is_active = true
    )
  );

CREATE POLICY "Authenticated users can manage business hours"
  ON business_hours FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- RLS Policies for payment_methods
CREATE POLICY "Public can view active payment methods"
  ON payment_methods FOR SELECT
  TO anon, authenticated
  USING (
    is_active = true AND
    EXISTS (
      SELECT 1 FROM business_info
      WHERE business_info.id = payment_methods.business_id
      AND business_info.is_active = true
    )
  );

CREATE POLICY "Authenticated users can manage payment methods"
  ON payment_methods FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- RLS Policies for social_media
CREATE POLICY "Public can view active social media"
  ON social_media FOR SELECT
  TO anon, authenticated
  USING (
    is_active = true AND
    EXISTS (
      SELECT 1 FROM business_info
      WHERE business_info.id = social_media.business_id
      AND business_info.is_active = true
    )
  );

CREATE POLICY "Authenticated users can manage social media"
  ON social_media FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- RLS Policies for customer_reviews
CREATE POLICY "Public can view active reviews"
  ON customer_reviews FOR SELECT
  TO anon, authenticated
  USING (
    is_active = true AND
    EXISTS (
      SELECT 1 FROM business_info
      WHERE business_info.id = customer_reviews.business_id
      AND business_info.is_active = true
    )
  );

CREATE POLICY "Authenticated users can manage reviews"
  ON customer_reviews FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- RLS Policies for business_attributes
CREATE POLICY "Public can view business attributes"
  ON business_attributes FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM business_info
      WHERE business_info.id = business_attributes.business_id
      AND business_info.is_active = true
    )
  );

CREATE POLICY "Authenticated users can manage business attributes"
  ON business_attributes FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_business_info_updated_at
  BEFORE UPDATE ON business_info
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_business_address_updated_at
  BEFORE UPDATE ON business_address
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_service_areas_updated_at
  BEFORE UPDATE ON service_areas
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_services_updated_at
  BEFORE UPDATE ON services
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_business_hours_updated_at
  BEFORE UPDATE ON business_hours
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customer_reviews_updated_at
  BEFORE UPDATE ON customer_reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();