/*
  # Update RLS Policies for Configuration Tables (Part 1)

  ## Overview
  Replaces existing RLS policies with organization-scoped multi-tenant policies
  for configuration tables. Implements role-based access control with platform
  admin bypass.

  ## Tables Updated
  - business_info, business_address, business_hours, business_attributes
  - services, service_areas, payment_methods, social_media
  - invoice_settings, tax_settings, mileage_settings
  - expense_categories, forecast_settings
  - notification_bar, site_pages

  ## Permission Matrix
  - Platform Admin: Full access to all organizations
  - Owner: Full access within organization
  - Admin: Can manage configuration
  - Member: Read-only access
  - Viewer: Read-only access

  ## Public Access
  Maintained for customer-facing data (active business info, services, etc.)
*/

-- business_info
DROP POLICY IF EXISTS "Public can view active business info" ON business_info;
DROP POLICY IF EXISTS "Authenticated users can update business info" ON business_info;
DROP POLICY IF EXISTS "Authenticated users can insert business info" ON business_info;

CREATE POLICY "Platform admins have full access to business_info"
  ON business_info FOR ALL
  TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

CREATE POLICY "Public can view active business info"
  ON business_info FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

CREATE POLICY "Organization members can view their business info"
  ON business_info FOR SELECT
  TO authenticated
  USING (can_view_org_data(organization_id));

CREATE POLICY "Organization admins can manage business info"
  ON business_info FOR ALL
  TO authenticated
  USING (can_manage_org_settings(organization_id))
  WITH CHECK (can_manage_org_settings(organization_id));

-- business_address
DROP POLICY IF EXISTS "Public can view business addresses" ON business_address;
DROP POLICY IF EXISTS "Authenticated users can manage business addresses" ON business_address;

CREATE POLICY "Platform admins have full access to business_address"
  ON business_address FOR ALL
  TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

CREATE POLICY "Public can view business addresses"
  ON business_address FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM business_info
      WHERE business_info.id = business_address.business_id
      AND business_info.is_active = true
      AND business_info.organization_id = business_address.organization_id
    )
  );

CREATE POLICY "Organization members can view their business address"
  ON business_address FOR SELECT
  TO authenticated
  USING (can_view_org_data(organization_id));

CREATE POLICY "Organization admins can manage business address"
  ON business_address FOR ALL
  TO authenticated
  USING (can_manage_org_settings(organization_id))
  WITH CHECK (can_manage_org_settings(organization_id));

-- business_hours
DROP POLICY IF EXISTS "Public can view business hours" ON business_hours;
DROP POLICY IF EXISTS "Authenticated users can manage business hours" ON business_hours;

CREATE POLICY "Platform admins have full access to business_hours"
  ON business_hours FOR ALL
  TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

CREATE POLICY "Public can view business hours"
  ON business_hours FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM business_info
      WHERE business_info.id = business_hours.business_id
      AND business_info.is_active = true
      AND business_info.organization_id = business_hours.organization_id
    )
  );

CREATE POLICY "Organization members can view their business hours"
  ON business_hours FOR SELECT
  TO authenticated
  USING (can_view_org_data(organization_id));

CREATE POLICY "Organization admins can manage business hours"
  ON business_hours FOR ALL
  TO authenticated
  USING (can_manage_org_settings(organization_id))
  WITH CHECK (can_manage_org_settings(organization_id));

-- business_attributes
DROP POLICY IF EXISTS "Public can view business attributes" ON business_attributes;
DROP POLICY IF EXISTS "Authenticated users can manage business attributes" ON business_attributes;

CREATE POLICY "Platform admins have full access to business_attributes"
  ON business_attributes FOR ALL
  TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

CREATE POLICY "Public can view business attributes"
  ON business_attributes FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM business_info
      WHERE business_info.id = business_attributes.business_id
      AND business_info.is_active = true
      AND business_info.organization_id = business_attributes.organization_id
    )
  );

CREATE POLICY "Organization members can view their business attributes"
  ON business_attributes FOR SELECT
  TO authenticated
  USING (can_view_org_data(organization_id));

CREATE POLICY "Organization admins can manage business attributes"
  ON business_attributes FOR ALL
  TO authenticated
  USING (can_manage_org_settings(organization_id))
  WITH CHECK (can_manage_org_settings(organization_id));

-- services
DROP POLICY IF EXISTS "Public can view active services" ON services;
DROP POLICY IF EXISTS "Authenticated users can manage services" ON services;

CREATE POLICY "Platform admins have full access to services"
  ON services FOR ALL
  TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

CREATE POLICY "Public can view active services"
  ON services FOR SELECT
  TO anon, authenticated
  USING (
    is_active = true AND
    EXISTS (
      SELECT 1 FROM business_info
      WHERE business_info.id = services.business_id
      AND business_info.is_active = true
      AND business_info.organization_id = services.organization_id
    )
  );

CREATE POLICY "Organization members can view their services"
  ON services FOR SELECT
  TO authenticated
  USING (can_view_org_data(organization_id));

CREATE POLICY "Organization admins can manage services"
  ON services FOR ALL
  TO authenticated
  USING (can_manage_org_settings(organization_id))
  WITH CHECK (can_manage_org_settings(organization_id));

-- service_areas
DROP POLICY IF EXISTS "Public can view active service areas" ON service_areas;
DROP POLICY IF EXISTS "Authenticated users can manage service areas" ON service_areas;

CREATE POLICY "Platform admins have full access to service_areas"
  ON service_areas FOR ALL
  TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

CREATE POLICY "Public can view active service areas"
  ON service_areas FOR SELECT
  TO anon, authenticated
  USING (
    is_active = true AND
    EXISTS (
      SELECT 1 FROM business_info
      WHERE business_info.id = service_areas.business_id
      AND business_info.is_active = true
      AND business_info.organization_id = service_areas.organization_id
    )
  );

CREATE POLICY "Organization members can view their service areas"
  ON service_areas FOR SELECT
  TO authenticated
  USING (can_view_org_data(organization_id));

CREATE POLICY "Organization admins can manage service areas"
  ON service_areas FOR ALL
  TO authenticated
  USING (can_manage_org_settings(organization_id))
  WITH CHECK (can_manage_org_settings(organization_id));

-- payment_methods
DROP POLICY IF EXISTS "Public can view active payment methods" ON payment_methods;
DROP POLICY IF EXISTS "Authenticated users can manage payment methods" ON payment_methods;

CREATE POLICY "Platform admins have full access to payment_methods"
  ON payment_methods FOR ALL
  TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

CREATE POLICY "Public can view active payment methods"
  ON payment_methods FOR SELECT
  TO anon, authenticated
  USING (
    is_active = true AND
    EXISTS (
      SELECT 1 FROM business_info
      WHERE business_info.id = payment_methods.business_id
      AND business_info.is_active = true
      AND business_info.organization_id = payment_methods.organization_id
    )
  );

CREATE POLICY "Organization members can view their payment methods"
  ON payment_methods FOR SELECT
  TO authenticated
  USING (can_view_org_data(organization_id));

CREATE POLICY "Organization admins can manage payment methods"
  ON payment_methods FOR ALL
  TO authenticated
  USING (can_manage_org_settings(organization_id))
  WITH CHECK (can_manage_org_settings(organization_id));

-- social_media
DROP POLICY IF EXISTS "Public can view active social media" ON social_media;
DROP POLICY IF EXISTS "Authenticated users can manage social media" ON social_media;

CREATE POLICY "Platform admins have full access to social_media"
  ON social_media FOR ALL
  TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

CREATE POLICY "Public can view active social media"
  ON social_media FOR SELECT
  TO anon, authenticated
  USING (
    is_active = true AND
    EXISTS (
      SELECT 1 FROM business_info
      WHERE business_info.id = social_media.business_id
      AND business_info.is_active = true
      AND business_info.organization_id = social_media.organization_id
    )
  );

CREATE POLICY "Organization members can view their social media"
  ON social_media FOR SELECT
  TO authenticated
  USING (can_view_org_data(organization_id));

CREATE POLICY "Organization admins can manage social media"
  ON social_media FOR ALL
  TO authenticated
  USING (can_manage_org_settings(organization_id))
  WITH CHECK (can_manage_org_settings(organization_id));
