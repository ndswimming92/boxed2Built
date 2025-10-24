/*
  # Enable Public Read Access to Business Tables

  1. Security Configuration
    - Enable RLS on all business tables (already enabled from previous migration)
    - Add public read policies for authenticated and anonymous users
    - Allows website visitors to view business information without authentication
  
  2. Tables with Public Read Access
    - business_info (active businesses only)
    - business_address
    - services (active services only)
    - service_areas (active areas only)
    - business_hours
    - payment_methods (active methods only)
    - social_media (active profiles only)
    - customer_reviews (active and verified reviews only)
    - business_attributes

  3. Important Notes
    - Only SELECT operations are allowed for public users
    - All other operations (INSERT, UPDATE, DELETE) remain admin-only
    - Policies filter by is_active flags to show only published content
*/

-- business_info: Public can read active businesses
CREATE POLICY "Public can read active business info"
  ON business_info
  FOR SELECT
  TO public
  USING (is_active = true);

-- business_address: Public can read all addresses (filtered by active business)
CREATE POLICY "Public can read business addresses"
  ON business_address
  FOR SELECT
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM business_info
      WHERE business_info.id = business_address.business_id
      AND business_info.is_active = true
    )
  );

-- services: Public can read active services
CREATE POLICY "Public can read active services"
  ON services
  FOR SELECT
  TO public
  USING (is_active = true);

-- service_areas: Public can read active service areas
CREATE POLICY "Public can read active service areas"
  ON service_areas
  FOR SELECT
  TO public
  USING (is_active = true);

-- business_hours: Public can read business hours
CREATE POLICY "Public can read business hours"
  ON business_hours
  FOR SELECT
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM business_info
      WHERE business_info.id = business_hours.business_id
      AND business_info.is_active = true
    )
  );

-- payment_methods: Public can read active payment methods
CREATE POLICY "Public can read active payment methods"
  ON payment_methods
  FOR SELECT
  TO public
  USING (is_active = true);

-- social_media: Public can read active social media profiles
CREATE POLICY "Public can read active social media"
  ON social_media
  FOR SELECT
  TO public
  USING (is_active = true);

-- customer_reviews: Public can read active and verified reviews only
CREATE POLICY "Public can read active reviews"
  ON customer_reviews
  FOR SELECT
  TO public
  USING (is_active = true AND is_verified = true);

-- business_attributes: Public can read business attributes
CREATE POLICY "Public can read business attributes"
  ON business_attributes
  FOR SELECT
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM business_info
      WHERE business_info.id = business_attributes.business_id
      AND business_info.is_active = true
    )
  );
