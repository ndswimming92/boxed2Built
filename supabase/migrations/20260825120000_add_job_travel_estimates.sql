/*
# Job travel time and route maps

1. New Tables
  - `travel_settings` — the address trips are measured *from*. Deliberately its
    own table rather than a column on `business_address`: that row is rendered
    publicly (site footer, LocalBusiness JSON-LD, the customer invoice page), so
    a home-based operator's street address cannot live there. One active row per
    organization.
  - `job_travel_estimates` — cached Mapbox results. Keyed on the origin/destination
    address *pair* rather than on a job, so several jobs at the same address share
    one row and editing a job never orphans an entry.

2. Security
  - RLS on both tables: organization members only, matching the pattern used by
    `calendar_feed_tokens`. No anon policy on either — `travel_settings` in
    particular holds a private address and must never be readable by the public
    site.
  - Only `travel_settings` is writable from the client (the admin settings page).
    `job_travel_estimates` is written exclusively by the `job-travel-estimate`
    edge function under the service role, which bypasses RLS, so it needs no
    INSERT/UPDATE policy.

3. Indexes
  - Unique index on the lower-cased address pair per organization: the cache
    lookup key, and the guard against duplicate rows for one trip.
  - Partial index on the active `travel_settings` row per organization.
*/

CREATE TABLE IF NOT EXISTS travel_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  origin_address text NOT NULL,
  origin_latitude numeric(10,7),
  origin_longitude numeric(10,7),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE travel_settings IS
  'Private starting point for job drive-time calculations. Never expose this in public pages, SEO schema, invoices or emails — unlike business_address, which is published. It is typically a home address.';
COMMENT ON COLUMN travel_settings.origin_latitude IS
  'Geocoded once by the job-travel-estimate function and cached here. NULL forces a re-geocode, which is how an address edit invalidates the old coordinates.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_travel_settings_active_org
  ON travel_settings (organization_id)
  WHERE is_active = true;

CREATE TABLE IF NOT EXISTS job_travel_estimates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  origin_address text NOT NULL,
  destination_address text NOT NULL,
  destination_latitude numeric(10,7),
  destination_longitude numeric(10,7),
  duration_seconds integer,
  distance_meters numeric,
  route_geometry text,
  status text NOT NULL DEFAULT 'ok',
  refreshed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT job_travel_estimates_status_check
    CHECK (status IN ('ok', 'not_found', 'no_route'))
);

COMMENT ON TABLE job_travel_estimates IS
  'Cached Mapbox drive times, keyed on the origin/destination address pair rather than on a job so repeat addresses reuse one row.';
COMMENT ON COLUMN job_travel_estimates.origin_address IS
  'Normalized cache key (trimmed, whitespace-collapsed, lowercased) — not display text. Display addresses come from travel_settings and the job row.';
COMMENT ON COLUMN job_travel_estimates.destination_address IS
  'Normalized cache key, matching origin_address. See job-travel-estimate/index.ts normalizeAddress().';
COMMENT ON COLUMN job_travel_estimates.route_geometry IS
  'Encoded polyline (precision 5) of the simplified route, used to redraw the static map without re-calling the Directions API.';
COMMENT ON COLUMN job_travel_estimates.status IS
  'ok = usable result; not_found = the address did not geocode; no_route = geocoded but undrivable. Failures are cached too, so a typo does not re-bill Mapbox on every card expand.';
COMMENT ON COLUMN job_travel_estimates.refreshed_at IS
  'When Mapbox was last called for this pair. Rows older than the function TTL are re-fetched, which also keeps cached geocodes within Mapbox temporary-geocoding terms.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_job_travel_estimates_pair
  ON job_travel_estimates (organization_id, lower(origin_address), lower(destination_address));

ALTER TABLE travel_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_travel_estimates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_org_travel_settings" ON travel_settings;
CREATE POLICY "select_own_org_travel_settings" ON travel_settings FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "insert_own_org_travel_settings" ON travel_settings;
CREATE POLICY "insert_own_org_travel_settings" ON travel_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "update_own_org_travel_settings" ON travel_settings;
CREATE POLICY "update_own_org_travel_settings" ON travel_settings FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "select_own_org_job_travel_estimates" ON job_travel_estimates;
CREATE POLICY "select_own_org_job_travel_estimates" ON job_travel_estimates FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

-- Editing the trip origin makes every cached estimate measured from the old one
-- wrong, so they are cleared rather than left to age out of the TTL.
DROP POLICY IF EXISTS "delete_own_org_job_travel_estimates" ON job_travel_estimates;
CREATE POLICY "delete_own_org_job_travel_estimates" ON job_travel_estimates FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

-- Seed the origin for the existing organization. Coordinates are left NULL so
-- the first drive-time lookup geocodes and backfills them.
INSERT INTO travel_settings (organization_id, origin_address)
SELECT id, '163 Bess Blvd, Spring Hill, TN 37174'
FROM organizations
WHERE id = '4e712e58-64f7-4b38-ad84-ecdf7d71f362'
ON CONFLICT DO NOTHING;
