/*
  # Consolidate Duplicate Permissive Policies - Part 1 (Admin-managed tables)

  This migration resolves the "Multiple Permissive Policies" warnings by consolidating
  overlapping policies. The key insight is that helper functions (can_view_org_data,
  can_manage_org_settings, has_org_permission) already include is_platform_admin() checks,
  making the separate "Platform admins have full access" ALL policies redundant.

  1. Strategy
    - Drop redundant "Platform admins have full access" ALL policies
    - Drop "Organization admins/members can manage" ALL policies
    - Keep existing SELECT policies (can_view_org_data already covers platform admins)
    - Create specific INSERT, UPDATE, DELETE policies using the same permission functions
    - Keep all public/anon policies unchanged

  2. Tables Modified (admin-level write access)
    - business_address, business_attributes, business_hours, business_info
    - customer_reviews, expense_categories, forecast_settings
    - invoice_settings, mileage_settings, tax_settings
    - notification_bar, payment_methods, qr_codes, qr_code_schedules
    - service_areas, services, site_pages, social_media

  3. Security
    - No change in effective permissions - same access patterns maintained
    - Each action now has exactly one policy per role, improving query performance
    - Platform admin access preserved through helper functions
*/

-- ============================================================
-- business_address
-- ============================================================
DROP POLICY IF EXISTS "Platform admins have full access to business_address" ON public.business_address;
DROP POLICY IF EXISTS "Organization admins can manage business address" ON public.business_address;

CREATE POLICY "Org admins can insert business address"
  ON public.business_address FOR INSERT TO authenticated
  WITH CHECK (can_manage_org_settings(organization_id));

CREATE POLICY "Org admins can update business address"
  ON public.business_address FOR UPDATE TO authenticated
  USING (can_manage_org_settings(organization_id))
  WITH CHECK (can_manage_org_settings(organization_id));

CREATE POLICY "Org admins can delete business address"
  ON public.business_address FOR DELETE TO authenticated
  USING (can_manage_org_settings(organization_id));

-- ============================================================
-- business_attributes
-- ============================================================
DROP POLICY IF EXISTS "Platform admins have full access to business_attributes" ON public.business_attributes;
DROP POLICY IF EXISTS "Organization admins can manage business attributes" ON public.business_attributes;

CREATE POLICY "Org admins can insert business attributes"
  ON public.business_attributes FOR INSERT TO authenticated
  WITH CHECK (can_manage_org_settings(organization_id));

CREATE POLICY "Org admins can update business attributes"
  ON public.business_attributes FOR UPDATE TO authenticated
  USING (can_manage_org_settings(organization_id))
  WITH CHECK (can_manage_org_settings(organization_id));

CREATE POLICY "Org admins can delete business attributes"
  ON public.business_attributes FOR DELETE TO authenticated
  USING (can_manage_org_settings(organization_id));

-- ============================================================
-- business_hours
-- ============================================================
DROP POLICY IF EXISTS "Platform admins have full access to business_hours" ON public.business_hours;
DROP POLICY IF EXISTS "Organization admins can manage business hours" ON public.business_hours;

CREATE POLICY "Org admins can insert business hours"
  ON public.business_hours FOR INSERT TO authenticated
  WITH CHECK (can_manage_org_settings(organization_id));

CREATE POLICY "Org admins can update business hours"
  ON public.business_hours FOR UPDATE TO authenticated
  USING (can_manage_org_settings(organization_id))
  WITH CHECK (can_manage_org_settings(organization_id));

CREATE POLICY "Org admins can delete business hours"
  ON public.business_hours FOR DELETE TO authenticated
  USING (can_manage_org_settings(organization_id));

-- ============================================================
-- business_info
-- ============================================================
DROP POLICY IF EXISTS "Platform admins have full access to business_info" ON public.business_info;
DROP POLICY IF EXISTS "Organization admins can manage business info" ON public.business_info;

CREATE POLICY "Org admins can insert business info"
  ON public.business_info FOR INSERT TO authenticated
  WITH CHECK (can_manage_org_settings(organization_id));

CREATE POLICY "Org admins can update business info"
  ON public.business_info FOR UPDATE TO authenticated
  USING (can_manage_org_settings(organization_id))
  WITH CHECK (can_manage_org_settings(organization_id));

CREATE POLICY "Org admins can delete business info"
  ON public.business_info FOR DELETE TO authenticated
  USING (can_manage_org_settings(organization_id));

-- ============================================================
-- customer_reviews
-- ============================================================
DROP POLICY IF EXISTS "Platform admins have full access to customer_reviews" ON public.customer_reviews;
DROP POLICY IF EXISTS "Organization admins can manage reviews" ON public.customer_reviews;

CREATE POLICY "Org admins can insert reviews"
  ON public.customer_reviews FOR INSERT TO authenticated
  WITH CHECK (can_manage_org_settings(organization_id));

CREATE POLICY "Org admins can update reviews"
  ON public.customer_reviews FOR UPDATE TO authenticated
  USING (can_manage_org_settings(organization_id))
  WITH CHECK (can_manage_org_settings(organization_id));

CREATE POLICY "Org admins can delete reviews"
  ON public.customer_reviews FOR DELETE TO authenticated
  USING (can_manage_org_settings(organization_id));

-- ============================================================
-- expense_categories
-- ============================================================
DROP POLICY IF EXISTS "Platform admins have full access to expense_categories" ON public.expense_categories;
DROP POLICY IF EXISTS "Organization admins can manage expense categories" ON public.expense_categories;

CREATE POLICY "Org admins can insert expense categories"
  ON public.expense_categories FOR INSERT TO authenticated
  WITH CHECK (can_manage_org_settings(organization_id));

CREATE POLICY "Org admins can update expense categories"
  ON public.expense_categories FOR UPDATE TO authenticated
  USING (can_manage_org_settings(organization_id))
  WITH CHECK (can_manage_org_settings(organization_id));

CREATE POLICY "Org admins can delete expense categories"
  ON public.expense_categories FOR DELETE TO authenticated
  USING (can_manage_org_settings(organization_id));

-- ============================================================
-- forecast_settings
-- ============================================================
DROP POLICY IF EXISTS "Platform admins have full access to forecast_settings" ON public.forecast_settings;
DROP POLICY IF EXISTS "Organization admins can manage forecast settings" ON public.forecast_settings;

CREATE POLICY "Org admins can insert forecast settings"
  ON public.forecast_settings FOR INSERT TO authenticated
  WITH CHECK (can_manage_org_settings(organization_id));

CREATE POLICY "Org admins can update forecast settings"
  ON public.forecast_settings FOR UPDATE TO authenticated
  USING (can_manage_org_settings(organization_id))
  WITH CHECK (can_manage_org_settings(organization_id));

CREATE POLICY "Org admins can delete forecast settings"
  ON public.forecast_settings FOR DELETE TO authenticated
  USING (can_manage_org_settings(organization_id));

-- ============================================================
-- invoice_settings
-- ============================================================
DROP POLICY IF EXISTS "Platform admins have full access to invoice_settings" ON public.invoice_settings;
DROP POLICY IF EXISTS "Organization admins can manage invoice settings" ON public.invoice_settings;

CREATE POLICY "Org admins can insert invoice settings"
  ON public.invoice_settings FOR INSERT TO authenticated
  WITH CHECK (can_manage_org_settings(organization_id));

CREATE POLICY "Org admins can update invoice settings"
  ON public.invoice_settings FOR UPDATE TO authenticated
  USING (can_manage_org_settings(organization_id))
  WITH CHECK (can_manage_org_settings(organization_id));

CREATE POLICY "Org admins can delete invoice settings"
  ON public.invoice_settings FOR DELETE TO authenticated
  USING (can_manage_org_settings(organization_id));

-- ============================================================
-- mileage_settings
-- ============================================================
DROP POLICY IF EXISTS "Platform admins have full access to mileage_settings" ON public.mileage_settings;
DROP POLICY IF EXISTS "Organization admins can manage mileage settings" ON public.mileage_settings;

CREATE POLICY "Org admins can insert mileage settings"
  ON public.mileage_settings FOR INSERT TO authenticated
  WITH CHECK (can_manage_org_settings(organization_id));

CREATE POLICY "Org admins can update mileage settings"
  ON public.mileage_settings FOR UPDATE TO authenticated
  USING (can_manage_org_settings(organization_id))
  WITH CHECK (can_manage_org_settings(organization_id));

CREATE POLICY "Org admins can delete mileage settings"
  ON public.mileage_settings FOR DELETE TO authenticated
  USING (can_manage_org_settings(organization_id));

-- ============================================================
-- tax_settings
-- ============================================================
DROP POLICY IF EXISTS "Platform admins have full access to tax_settings" ON public.tax_settings;
DROP POLICY IF EXISTS "Organization admins can manage tax settings" ON public.tax_settings;

CREATE POLICY "Org admins can insert tax settings"
  ON public.tax_settings FOR INSERT TO authenticated
  WITH CHECK (can_manage_org_settings(organization_id));

CREATE POLICY "Org admins can update tax settings"
  ON public.tax_settings FOR UPDATE TO authenticated
  USING (can_manage_org_settings(organization_id))
  WITH CHECK (can_manage_org_settings(organization_id));

CREATE POLICY "Org admins can delete tax settings"
  ON public.tax_settings FOR DELETE TO authenticated
  USING (can_manage_org_settings(organization_id));

-- ============================================================
-- notification_bar
-- ============================================================
DROP POLICY IF EXISTS "Platform admins have full access to notification_bar" ON public.notification_bar;
DROP POLICY IF EXISTS "Organization admins can manage notifications" ON public.notification_bar;

CREATE POLICY "Org admins can insert notifications"
  ON public.notification_bar FOR INSERT TO authenticated
  WITH CHECK (can_manage_org_settings(organization_id));

CREATE POLICY "Org admins can update notifications"
  ON public.notification_bar FOR UPDATE TO authenticated
  USING (can_manage_org_settings(organization_id))
  WITH CHECK (can_manage_org_settings(organization_id));

CREATE POLICY "Org admins can delete notifications"
  ON public.notification_bar FOR DELETE TO authenticated
  USING (can_manage_org_settings(organization_id));

-- ============================================================
-- payment_methods
-- ============================================================
DROP POLICY IF EXISTS "Platform admins have full access to payment_methods" ON public.payment_methods;
DROP POLICY IF EXISTS "Organization admins can manage payment methods" ON public.payment_methods;

CREATE POLICY "Org admins can insert payment methods"
  ON public.payment_methods FOR INSERT TO authenticated
  WITH CHECK (can_manage_org_settings(organization_id));

CREATE POLICY "Org admins can update payment methods"
  ON public.payment_methods FOR UPDATE TO authenticated
  USING (can_manage_org_settings(organization_id))
  WITH CHECK (can_manage_org_settings(organization_id));

CREATE POLICY "Org admins can delete payment methods"
  ON public.payment_methods FOR DELETE TO authenticated
  USING (can_manage_org_settings(organization_id));

-- ============================================================
-- qr_codes
-- ============================================================
DROP POLICY IF EXISTS "Platform admins have full access to qr_codes" ON public.qr_codes;
DROP POLICY IF EXISTS "Organization admins can manage qr codes" ON public.qr_codes;

CREATE POLICY "Org admins can insert qr codes"
  ON public.qr_codes FOR INSERT TO authenticated
  WITH CHECK (can_manage_org_settings(organization_id));

CREATE POLICY "Org admins can update qr codes"
  ON public.qr_codes FOR UPDATE TO authenticated
  USING (can_manage_org_settings(organization_id))
  WITH CHECK (can_manage_org_settings(organization_id));

CREATE POLICY "Org admins can delete qr codes"
  ON public.qr_codes FOR DELETE TO authenticated
  USING (can_manage_org_settings(organization_id));

-- ============================================================
-- qr_code_schedules
-- ============================================================
DROP POLICY IF EXISTS "Platform admins have full access to qr_code_schedules" ON public.qr_code_schedules;
DROP POLICY IF EXISTS "Organization admins can manage qr code schedules" ON public.qr_code_schedules;

CREATE POLICY "Org admins can insert qr code schedules"
  ON public.qr_code_schedules FOR INSERT TO authenticated
  WITH CHECK (can_manage_org_settings(organization_id));

CREATE POLICY "Org admins can update qr code schedules"
  ON public.qr_code_schedules FOR UPDATE TO authenticated
  USING (can_manage_org_settings(organization_id))
  WITH CHECK (can_manage_org_settings(organization_id));

CREATE POLICY "Org admins can delete qr code schedules"
  ON public.qr_code_schedules FOR DELETE TO authenticated
  USING (can_manage_org_settings(organization_id));

-- ============================================================
-- service_areas
-- ============================================================
DROP POLICY IF EXISTS "Platform admins have full access to service_areas" ON public.service_areas;
DROP POLICY IF EXISTS "Organization admins can manage service areas" ON public.service_areas;

CREATE POLICY "Org admins can insert service areas"
  ON public.service_areas FOR INSERT TO authenticated
  WITH CHECK (can_manage_org_settings(organization_id));

CREATE POLICY "Org admins can update service areas"
  ON public.service_areas FOR UPDATE TO authenticated
  USING (can_manage_org_settings(organization_id))
  WITH CHECK (can_manage_org_settings(organization_id));

CREATE POLICY "Org admins can delete service areas"
  ON public.service_areas FOR DELETE TO authenticated
  USING (can_manage_org_settings(organization_id));

-- ============================================================
-- services
-- ============================================================
DROP POLICY IF EXISTS "Platform admins have full access to services" ON public.services;
DROP POLICY IF EXISTS "Organization admins can manage services" ON public.services;

CREATE POLICY "Org admins can insert services"
  ON public.services FOR INSERT TO authenticated
  WITH CHECK (can_manage_org_settings(organization_id));

CREATE POLICY "Org admins can update services"
  ON public.services FOR UPDATE TO authenticated
  USING (can_manage_org_settings(organization_id))
  WITH CHECK (can_manage_org_settings(organization_id));

CREATE POLICY "Org admins can delete services"
  ON public.services FOR DELETE TO authenticated
  USING (can_manage_org_settings(organization_id));

-- ============================================================
-- site_pages
-- ============================================================
DROP POLICY IF EXISTS "Platform admins have full access to site_pages" ON public.site_pages;
DROP POLICY IF EXISTS "Organization admins can manage site pages" ON public.site_pages;

CREATE POLICY "Org admins can insert site pages"
  ON public.site_pages FOR INSERT TO authenticated
  WITH CHECK (can_manage_org_settings(organization_id));

CREATE POLICY "Org admins can update site pages"
  ON public.site_pages FOR UPDATE TO authenticated
  USING (can_manage_org_settings(organization_id))
  WITH CHECK (can_manage_org_settings(organization_id));

CREATE POLICY "Org admins can delete site pages"
  ON public.site_pages FOR DELETE TO authenticated
  USING (can_manage_org_settings(organization_id));

-- ============================================================
-- social_media
-- ============================================================
DROP POLICY IF EXISTS "Platform admins have full access to social_media" ON public.social_media;
DROP POLICY IF EXISTS "Organization admins can manage social media" ON public.social_media;

CREATE POLICY "Org admins can insert social media"
  ON public.social_media FOR INSERT TO authenticated
  WITH CHECK (can_manage_org_settings(organization_id));

CREATE POLICY "Org admins can update social media"
  ON public.social_media FOR UPDATE TO authenticated
  USING (can_manage_org_settings(organization_id))
  WITH CHECK (can_manage_org_settings(organization_id));

CREATE POLICY "Org admins can delete social media"
  ON public.social_media FOR DELETE TO authenticated
  USING (can_manage_org_settings(organization_id));
