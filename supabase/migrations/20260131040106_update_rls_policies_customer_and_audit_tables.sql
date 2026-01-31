/*
  # Update RLS Policies for Customer-Facing and Audit Tables (Part 4)

  ## Overview
  Updates RLS policies for customer-facing tables (allow public submissions)
  and audit logs (platform admins see all, members see only their org).

  ## Tables Updated
  - form_inquiries, saved_requests
  - gallery_items, customer_reviews
  - qr_scans
  - admin_audit_logs

  ## Permission Matrix (Customer-Facing)
  - Anonymous: Can submit forms and scan QR codes
  - Public: Can view active content (gallery, reviews)
  - Member+: Can manage organizational content

  ## Permission Matrix (Audit Logs)
  - Platform Admin: Can view all logs across all orgs
  - Member+: Can view logs for their organization only
  - All authenticated: Can create logs (system-wide auditing)
*/

-- form_inquiries (public can submit)
DROP POLICY IF EXISTS "Anyone can submit form inquiries" ON form_inquiries;
DROP POLICY IF EXISTS "Authenticated users can view inquiries" ON form_inquiries;
DROP POLICY IF EXISTS "Authenticated users can manage inquiries" ON form_inquiries;

CREATE POLICY "Platform admins have full access to form_inquiries"
  ON form_inquiries FOR ALL
  TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

CREATE POLICY "Anyone can submit form inquiries"
  ON form_inquiries FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Organization members can view their form inquiries"
  ON form_inquiries FOR SELECT
  TO authenticated
  USING (can_view_org_data(organization_id));

CREATE POLICY "Organization members can manage form inquiries"
  ON form_inquiries FOR UPDATE
  TO authenticated
  USING (has_org_permission(organization_id, 'member'))
  WITH CHECK (has_org_permission(organization_id, 'member'));

CREATE POLICY "Organization admins can delete form inquiries"
  ON form_inquiries FOR DELETE
  TO authenticated
  USING (can_manage_org_settings(organization_id));

-- saved_requests (public can submit)
DROP POLICY IF EXISTS "Anyone can create saved requests" ON saved_requests;
DROP POLICY IF EXISTS "Authenticated users can view saved requests" ON saved_requests;
DROP POLICY IF EXISTS "Authenticated users can manage saved requests" ON saved_requests;

CREATE POLICY "Platform admins have full access to saved_requests"
  ON saved_requests FOR ALL
  TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

CREATE POLICY "Anyone can create saved requests"
  ON saved_requests FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Organization members can view their saved requests"
  ON saved_requests FOR SELECT
  TO authenticated
  USING (can_view_org_data(organization_id));

CREATE POLICY "Organization members can manage saved requests"
  ON saved_requests FOR UPDATE
  TO authenticated
  USING (has_org_permission(organization_id, 'member'))
  WITH CHECK (has_org_permission(organization_id, 'member'));

CREATE POLICY "Organization admins can delete saved requests"
  ON saved_requests FOR DELETE
  TO authenticated
  USING (can_manage_org_settings(organization_id));

-- gallery_items (public can view active items)
DROP POLICY IF EXISTS "Public can view active gallery items" ON gallery_items;
DROP POLICY IF EXISTS "Authenticated users can manage gallery items" ON gallery_items;

CREATE POLICY "Platform admins have full access to gallery_items"
  ON gallery_items FOR ALL
  TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

CREATE POLICY "Public can view active gallery items"
  ON gallery_items FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

CREATE POLICY "Organization members can view their gallery items"
  ON gallery_items FOR SELECT
  TO authenticated
  USING (can_view_org_data(organization_id));

CREATE POLICY "Organization members can manage gallery items"
  ON gallery_items FOR ALL
  TO authenticated
  USING (has_org_permission(organization_id, 'member'))
  WITH CHECK (has_org_permission(organization_id, 'member'));

-- customer_reviews (public can view active reviews)
DROP POLICY IF EXISTS "Public can view active reviews" ON customer_reviews;
DROP POLICY IF EXISTS "Authenticated users can manage reviews" ON customer_reviews;

CREATE POLICY "Platform admins have full access to customer_reviews"
  ON customer_reviews FOR ALL
  TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

CREATE POLICY "Public can view active reviews"
  ON customer_reviews FOR SELECT
  TO anon, authenticated
  USING (
    is_active = true AND
    EXISTS (
      SELECT 1 FROM business_info
      WHERE business_info.id = customer_reviews.business_id
      AND business_info.is_active = true
      AND business_info.organization_id = customer_reviews.organization_id
    )
  );

CREATE POLICY "Organization members can view their reviews"
  ON customer_reviews FOR SELECT
  TO authenticated
  USING (can_view_org_data(organization_id));

CREATE POLICY "Organization admins can manage reviews"
  ON customer_reviews FOR ALL
  TO authenticated
  USING (can_manage_org_settings(organization_id))
  WITH CHECK (can_manage_org_settings(organization_id));

-- qr_scans (public can create scans)
DROP POLICY IF EXISTS "Anyone can create qr scans" ON qr_scans;
DROP POLICY IF EXISTS "Authenticated users can view qr scans" ON qr_scans;

CREATE POLICY "Platform admins have full access to qr_scans"
  ON qr_scans FOR ALL
  TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

CREATE POLICY "Anyone can create qr scans"
  ON qr_scans FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Organization members can view their qr scans"
  ON qr_scans FOR SELECT
  TO authenticated
  USING (can_view_org_data(organization_id));

CREATE POLICY "Organization admins can delete qr scans"
  ON qr_scans FOR DELETE
  TO authenticated
  USING (can_manage_org_settings(organization_id));

-- admin_audit_logs (special: all authenticated can insert for auditing)
DROP POLICY IF EXISTS "Authenticated users can create audit logs" ON admin_audit_logs;
DROP POLICY IF EXISTS "Authenticated users can view audit logs" ON admin_audit_logs;

CREATE POLICY "Platform admins have full access to admin_audit_logs"
  ON admin_audit_logs FOR ALL
  TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

CREATE POLICY "All authenticated users can create audit logs"
  ON admin_audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Organization members can view their audit logs"
  ON admin_audit_logs FOR SELECT
  TO authenticated
  USING (can_view_org_data(organization_id));

-- Audit logs are immutable - no UPDATE policy
-- Only platform admins can DELETE (via platform admin policy above)
