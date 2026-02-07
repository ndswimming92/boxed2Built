/*
  # Consolidate Public SELECT Policies

  Resolves remaining "Multiple Permissive Policies" for SELECT on public-facing tables.
  Each table had both an org-member SELECT policy (authenticated) and a public SELECT
  policy (anon+authenticated), creating overlap for the authenticated role.

  1. Strategy
    - Combine org member and public conditions into a single authenticated SELECT policy
    - Create separate anon-only SELECT policy for public data
    - This ensures exactly one SELECT policy per role per table

  2. Tables Modified
    - business_address, business_attributes, business_hours, business_info
    - customer_reviews, gallery_items, notification_bar, payment_methods
    - service_areas, services, site_pages, social_media

  3. Security
    - Authenticated org members can still see all their org data
    - Authenticated non-members and anon users can see only public/active data
    - No change in effective access patterns
*/

-- ============================================================
-- business_info
-- ============================================================
DROP POLICY IF EXISTS "Organization members can view their business info" ON public.business_info;
DROP POLICY IF EXISTS "Public can view active business info" ON public.business_info;

CREATE POLICY "Authenticated select business info"
  ON public.business_info FOR SELECT TO authenticated
  USING (can_view_org_data(organization_id) OR is_active = true);

CREATE POLICY "Anon select active business info"
  ON public.business_info FOR SELECT TO anon
  USING (is_active = true);

-- ============================================================
-- business_address
-- ============================================================
DROP POLICY IF EXISTS "Organization members can view their business address" ON public.business_address;
DROP POLICY IF EXISTS "Public can view business addresses" ON public.business_address;

CREATE POLICY "Authenticated select business address"
  ON public.business_address FOR SELECT TO authenticated
  USING (
    can_view_org_data(organization_id)
    OR EXISTS (
      SELECT 1 FROM public.business_info
      WHERE business_info.id = business_address.business_id
        AND business_info.is_active = true
        AND business_info.organization_id = business_address.organization_id
    )
  );

CREATE POLICY "Anon select business address"
  ON public.business_address FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.business_info
      WHERE business_info.id = business_address.business_id
        AND business_info.is_active = true
        AND business_info.organization_id = business_address.organization_id
    )
  );

-- ============================================================
-- business_attributes
-- ============================================================
DROP POLICY IF EXISTS "Organization members can view their business attributes" ON public.business_attributes;
DROP POLICY IF EXISTS "Public can view business attributes" ON public.business_attributes;

CREATE POLICY "Authenticated select business attributes"
  ON public.business_attributes FOR SELECT TO authenticated
  USING (
    can_view_org_data(organization_id)
    OR EXISTS (
      SELECT 1 FROM public.business_info
      WHERE business_info.id = business_attributes.business_id
        AND business_info.is_active = true
        AND business_info.organization_id = business_attributes.organization_id
    )
  );

CREATE POLICY "Anon select business attributes"
  ON public.business_attributes FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.business_info
      WHERE business_info.id = business_attributes.business_id
        AND business_info.is_active = true
        AND business_info.organization_id = business_attributes.organization_id
    )
  );

-- ============================================================
-- business_hours
-- ============================================================
DROP POLICY IF EXISTS "Organization members can view their business hours" ON public.business_hours;
DROP POLICY IF EXISTS "Public can view business hours" ON public.business_hours;

CREATE POLICY "Authenticated select business hours"
  ON public.business_hours FOR SELECT TO authenticated
  USING (
    can_view_org_data(organization_id)
    OR EXISTS (
      SELECT 1 FROM public.business_info
      WHERE business_info.id = business_hours.business_id
        AND business_info.is_active = true
        AND business_info.organization_id = business_hours.organization_id
    )
  );

CREATE POLICY "Anon select business hours"
  ON public.business_hours FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.business_info
      WHERE business_info.id = business_hours.business_id
        AND business_info.is_active = true
        AND business_info.organization_id = business_hours.organization_id
    )
  );

-- ============================================================
-- customer_reviews
-- ============================================================
DROP POLICY IF EXISTS "Organization members can view their reviews" ON public.customer_reviews;
DROP POLICY IF EXISTS "Public can view active reviews" ON public.customer_reviews;

CREATE POLICY "Authenticated select reviews"
  ON public.customer_reviews FOR SELECT TO authenticated
  USING (
    can_view_org_data(organization_id)
    OR (
      is_active = true AND EXISTS (
        SELECT 1 FROM public.business_info
        WHERE business_info.id = customer_reviews.business_id
          AND business_info.is_active = true
          AND business_info.organization_id = customer_reviews.organization_id
      )
    )
  );

CREATE POLICY "Anon select active reviews"
  ON public.customer_reviews FOR SELECT TO anon
  USING (
    is_active = true AND EXISTS (
      SELECT 1 FROM public.business_info
      WHERE business_info.id = customer_reviews.business_id
        AND business_info.is_active = true
        AND business_info.organization_id = customer_reviews.organization_id
    )
  );

-- ============================================================
-- gallery_items
-- ============================================================
DROP POLICY IF EXISTS "Organization members can view their gallery items" ON public.gallery_items;
DROP POLICY IF EXISTS "Public can view active gallery items" ON public.gallery_items;

CREATE POLICY "Authenticated select gallery items"
  ON public.gallery_items FOR SELECT TO authenticated
  USING (can_view_org_data(organization_id) OR is_active = true);

CREATE POLICY "Anon select active gallery items"
  ON public.gallery_items FOR SELECT TO anon
  USING (is_active = true);

-- ============================================================
-- notification_bar
-- ============================================================
DROP POLICY IF EXISTS "Organization members can view their notifications" ON public.notification_bar;
DROP POLICY IF EXISTS "Public can view enabled notifications" ON public.notification_bar;

CREATE POLICY "Authenticated select notifications"
  ON public.notification_bar FOR SELECT TO authenticated
  USING (can_view_org_data(organization_id) OR is_enabled = true);

CREATE POLICY "Anon select enabled notifications"
  ON public.notification_bar FOR SELECT TO anon
  USING (is_enabled = true);

-- ============================================================
-- payment_methods
-- ============================================================
DROP POLICY IF EXISTS "Organization members can view their payment methods" ON public.payment_methods;
DROP POLICY IF EXISTS "Public can view active payment methods" ON public.payment_methods;

CREATE POLICY "Authenticated select payment methods"
  ON public.payment_methods FOR SELECT TO authenticated
  USING (
    can_view_org_data(organization_id)
    OR (
      is_active = true AND EXISTS (
        SELECT 1 FROM public.business_info
        WHERE business_info.id = payment_methods.business_id
          AND business_info.is_active = true
          AND business_info.organization_id = payment_methods.organization_id
      )
    )
  );

CREATE POLICY "Anon select active payment methods"
  ON public.payment_methods FOR SELECT TO anon
  USING (
    is_active = true AND EXISTS (
      SELECT 1 FROM public.business_info
      WHERE business_info.id = payment_methods.business_id
        AND business_info.is_active = true
        AND business_info.organization_id = payment_methods.organization_id
    )
  );

-- ============================================================
-- service_areas
-- ============================================================
DROP POLICY IF EXISTS "Organization members can view their service areas" ON public.service_areas;
DROP POLICY IF EXISTS "Public can view active service areas" ON public.service_areas;

CREATE POLICY "Authenticated select service areas"
  ON public.service_areas FOR SELECT TO authenticated
  USING (
    can_view_org_data(organization_id)
    OR (
      is_active = true AND EXISTS (
        SELECT 1 FROM public.business_info
        WHERE business_info.id = service_areas.business_id
          AND business_info.is_active = true
          AND business_info.organization_id = service_areas.organization_id
      )
    )
  );

CREATE POLICY "Anon select active service areas"
  ON public.service_areas FOR SELECT TO anon
  USING (
    is_active = true AND EXISTS (
      SELECT 1 FROM public.business_info
      WHERE business_info.id = service_areas.business_id
        AND business_info.is_active = true
        AND business_info.organization_id = service_areas.organization_id
    )
  );

-- ============================================================
-- services
-- ============================================================
DROP POLICY IF EXISTS "Organization members can view their services" ON public.services;
DROP POLICY IF EXISTS "Public can view active services" ON public.services;

CREATE POLICY "Authenticated select services"
  ON public.services FOR SELECT TO authenticated
  USING (
    can_view_org_data(organization_id)
    OR (
      is_active = true AND EXISTS (
        SELECT 1 FROM public.business_info
        WHERE business_info.id = services.business_id
          AND business_info.is_active = true
          AND business_info.organization_id = services.organization_id
      )
    )
  );

CREATE POLICY "Anon select active services"
  ON public.services FOR SELECT TO anon
  USING (
    is_active = true AND EXISTS (
      SELECT 1 FROM public.business_info
      WHERE business_info.id = services.business_id
        AND business_info.is_active = true
        AND business_info.organization_id = services.organization_id
    )
  );

-- ============================================================
-- site_pages
-- ============================================================
DROP POLICY IF EXISTS "Organization members can view their site pages" ON public.site_pages;
DROP POLICY IF EXISTS "Public can view active site pages" ON public.site_pages;

CREATE POLICY "Authenticated select site pages"
  ON public.site_pages FOR SELECT TO authenticated
  USING (can_view_org_data(organization_id) OR is_active = true);

CREATE POLICY "Anon select active site pages"
  ON public.site_pages FOR SELECT TO anon
  USING (is_active = true);

-- ============================================================
-- social_media
-- ============================================================
DROP POLICY IF EXISTS "Organization members can view their social media" ON public.social_media;
DROP POLICY IF EXISTS "Public can view active social media" ON public.social_media;

CREATE POLICY "Authenticated select social media"
  ON public.social_media FOR SELECT TO authenticated
  USING (
    can_view_org_data(organization_id)
    OR (
      is_active = true AND EXISTS (
        SELECT 1 FROM public.business_info
        WHERE business_info.id = social_media.business_id
          AND business_info.is_active = true
          AND business_info.organization_id = social_media.organization_id
      )
    )
  );

CREATE POLICY "Anon select active social media"
  ON public.social_media FOR SELECT TO anon
  USING (
    is_active = true AND EXISTS (
      SELECT 1 FROM public.business_info
      WHERE business_info.id = social_media.business_id
        AND business_info.is_active = true
        AND business_info.organization_id = social_media.organization_id
    )
  );
