/*
  # Update RLS Policies for Settings Tables (Part 2 - Corrected)

  ## Overview
  Updates RLS policies for settings tables with organization-scoped access.

  ## Tables Updated
  - invoice_settings, tax_settings, mileage_settings
  - expense_categories, forecast_settings
  - notification_bar, site_pages
  - qr_codes, qr_code_schedules

  ## Permission Matrix
  - Platform Admin: Full access
  - Owner/Admin: Full management access
  - Member/Viewer: Read-only access
*/

-- invoice_settings
DROP POLICY IF EXISTS "Authenticated users can view invoice settings" ON invoice_settings;
DROP POLICY IF EXISTS "Authenticated users can manage invoice settings" ON invoice_settings;

CREATE POLICY "Platform admins have full access to invoice_settings"
  ON invoice_settings FOR ALL
  TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

CREATE POLICY "Organization members can view their invoice settings"
  ON invoice_settings FOR SELECT
  TO authenticated
  USING (can_view_org_data(organization_id));

CREATE POLICY "Organization admins can manage invoice settings"
  ON invoice_settings FOR ALL
  TO authenticated
  USING (can_manage_org_settings(organization_id))
  WITH CHECK (can_manage_org_settings(organization_id));

-- tax_settings
DROP POLICY IF EXISTS "Authenticated users can view tax settings" ON tax_settings;
DROP POLICY IF EXISTS "Authenticated users can manage tax settings" ON tax_settings;

CREATE POLICY "Platform admins have full access to tax_settings"
  ON tax_settings FOR ALL
  TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

CREATE POLICY "Organization members can view their tax settings"
  ON tax_settings FOR SELECT
  TO authenticated
  USING (can_view_org_data(organization_id));

CREATE POLICY "Organization admins can manage tax settings"
  ON tax_settings FOR ALL
  TO authenticated
  USING (can_manage_org_settings(organization_id))
  WITH CHECK (can_manage_org_settings(organization_id));

-- mileage_settings
DROP POLICY IF EXISTS "Authenticated users can view mileage settings" ON mileage_settings;
DROP POLICY IF EXISTS "Authenticated users can manage mileage settings" ON mileage_settings;

CREATE POLICY "Platform admins have full access to mileage_settings"
  ON mileage_settings FOR ALL
  TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

CREATE POLICY "Organization members can view their mileage settings"
  ON mileage_settings FOR SELECT
  TO authenticated
  USING (can_view_org_data(organization_id));

CREATE POLICY "Organization admins can manage mileage settings"
  ON mileage_settings FOR ALL
  TO authenticated
  USING (can_manage_org_settings(organization_id))
  WITH CHECK (can_manage_org_settings(organization_id));

-- expense_categories
DROP POLICY IF EXISTS "Authenticated users can view expense categories" ON expense_categories;
DROP POLICY IF EXISTS "Authenticated users can manage expense categories" ON expense_categories;

CREATE POLICY "Platform admins have full access to expense_categories"
  ON expense_categories FOR ALL
  TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

CREATE POLICY "Organization members can view their expense categories"
  ON expense_categories FOR SELECT
  TO authenticated
  USING (can_view_org_data(organization_id));

CREATE POLICY "Organization admins can manage expense categories"
  ON expense_categories FOR ALL
  TO authenticated
  USING (can_manage_org_settings(organization_id))
  WITH CHECK (can_manage_org_settings(organization_id));

-- forecast_settings
DROP POLICY IF EXISTS "Authenticated users can view forecast settings" ON forecast_settings;
DROP POLICY IF EXISTS "Authenticated users can manage forecast settings" ON forecast_settings;

CREATE POLICY "Platform admins have full access to forecast_settings"
  ON forecast_settings FOR ALL
  TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

CREATE POLICY "Organization members can view their forecast settings"
  ON forecast_settings FOR SELECT
  TO authenticated
  USING (can_view_org_data(organization_id));

CREATE POLICY "Organization admins can manage forecast settings"
  ON forecast_settings FOR ALL
  TO authenticated
  USING (can_manage_org_settings(organization_id))
  WITH CHECK (can_manage_org_settings(organization_id));

-- notification_bar (uses is_enabled, not is_active)
DROP POLICY IF EXISTS "Anyone can view active notifications" ON notification_bar;
DROP POLICY IF EXISTS "Authenticated users can manage notifications" ON notification_bar;

CREATE POLICY "Platform admins have full access to notification_bar"
  ON notification_bar FOR ALL
  TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

CREATE POLICY "Public can view enabled notifications"
  ON notification_bar FOR SELECT
  TO anon, authenticated
  USING (is_enabled = true);

CREATE POLICY "Organization members can view their notifications"
  ON notification_bar FOR SELECT
  TO authenticated
  USING (can_view_org_data(organization_id));

CREATE POLICY "Organization admins can manage notifications"
  ON notification_bar FOR ALL
  TO authenticated
  USING (can_manage_org_settings(organization_id))
  WITH CHECK (can_manage_org_settings(organization_id));

-- site_pages
DROP POLICY IF EXISTS "Public can view active site pages" ON site_pages;
DROP POLICY IF EXISTS "Authenticated users can manage site pages" ON site_pages;

CREATE POLICY "Platform admins have full access to site_pages"
  ON site_pages FOR ALL
  TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

CREATE POLICY "Public can view active site pages"
  ON site_pages FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

CREATE POLICY "Organization members can view their site pages"
  ON site_pages FOR SELECT
  TO authenticated
  USING (can_view_org_data(organization_id));

CREATE POLICY "Organization admins can manage site pages"
  ON site_pages FOR ALL
  TO authenticated
  USING (can_manage_org_settings(organization_id))
  WITH CHECK (can_manage_org_settings(organization_id));

-- qr_codes (uses status, not is_active)
DROP POLICY IF EXISTS "Authenticated users can view qr codes" ON qr_codes;
DROP POLICY IF EXISTS "Authenticated users can manage qr codes" ON qr_codes;

CREATE POLICY "Platform admins have full access to qr_codes"
  ON qr_codes FOR ALL
  TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

CREATE POLICY "Organization members can view their qr codes"
  ON qr_codes FOR SELECT
  TO authenticated
  USING (can_view_org_data(organization_id));

CREATE POLICY "Organization admins can manage qr codes"
  ON qr_codes FOR ALL
  TO authenticated
  USING (can_manage_org_settings(organization_id))
  WITH CHECK (can_manage_org_settings(organization_id));

-- qr_code_schedules
DROP POLICY IF EXISTS "Authenticated users can view qr code schedules" ON qr_code_schedules;
DROP POLICY IF EXISTS "Authenticated users can manage qr code schedules" ON qr_code_schedules;

CREATE POLICY "Platform admins have full access to qr_code_schedules"
  ON qr_code_schedules FOR ALL
  TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

CREATE POLICY "Organization members can view their qr code schedules"
  ON qr_code_schedules FOR SELECT
  TO authenticated
  USING (can_view_org_data(organization_id));

CREATE POLICY "Organization admins can manage qr code schedules"
  ON qr_code_schedules FOR ALL
  TO authenticated
  USING (can_manage_org_settings(organization_id))
  WITH CHECK (can_manage_org_settings(organization_id));
