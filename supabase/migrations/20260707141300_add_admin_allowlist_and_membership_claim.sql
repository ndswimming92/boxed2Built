/*
  # Admin allowlist and self-service membership claim

  ## Overview
  Adds a server-side allowlist so trusted admin emails/domains can be granted
  membership in the Boxed2Built organization without relying on the browser.
  A SECURITY DEFINER RPC lets an authenticated user claim their own membership
  based on that allowlist, bypassing the members-table RLS insert restriction
  in a controlled, auditable way.

  ## New Table
  - `admin_allowlist`
    - `id` (uuid, PK)
    - `email` (text, nullable) - specific email to allow (takes precedence)
    - `domain` (text, nullable) - email domain to allow
    - `role` (organization_role, default 'admin') - role granted on claim
    - `created_at` (timestamptz)

  ## Security
  - RLS enabled on `admin_allowlist`; only platform admins may read it.
  - No client insert/update/delete policies (managed via migrations only).
  - `claim_admin_membership()` runs as SECURITY DEFINER and reads the caller's
    email from `auth.users`, matching it against the allowlist server-side.

  ## Seed
  - domain `boxed2built.com` -> owner
  - email `boxed2builtco@gmail.com` -> owner

  ## Backfill
  - Existing auth users matching the allowlist are granted owner/role membership
    in the `boxed2built` organization (idempotent upsert).
*/

-- =====================================================
-- Step 1: allowlist table
-- =====================================================

CREATE TABLE IF NOT EXISTS admin_allowlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text,
  domain text,
  role organization_role NOT NULL DEFAULT 'admin',
  created_at timestamptz DEFAULT now(),
  CONSTRAINT admin_allowlist_email_or_domain CHECK (email IS NOT NULL OR domain IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_allowlist_email ON admin_allowlist (lower(email)) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_allowlist_domain ON admin_allowlist (lower(domain)) WHERE domain IS NOT NULL;

ALTER TABLE admin_allowlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins can view allowlist"
  ON admin_allowlist FOR SELECT
  TO authenticated
  USING (is_platform_admin());

-- =====================================================
-- Step 2: seed allowlist entries
-- =====================================================

INSERT INTO admin_allowlist (domain, role)
VALUES ('boxed2built.com', 'owner')
ON CONFLICT DO NOTHING;

INSERT INTO admin_allowlist (email, role)
VALUES ('boxed2builtco@gmail.com', 'owner')
ON CONFLICT DO NOTHING;

-- =====================================================
-- Step 3: self-service claim RPC (SECURITY DEFINER)
-- =====================================================

CREATE OR REPLACE FUNCTION claim_admin_membership()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_email text;
  v_domain text;
  v_role organization_role;
  v_org_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;
  IF v_email IS NULL THEN
    RETURN false;
  END IF;

  v_email := lower(v_email);
  v_domain := split_part(v_email, '@', 2);

  -- Prefer an email-specific allowlist entry over a domain match.
  SELECT role INTO v_role
  FROM admin_allowlist
  WHERE email IS NOT NULL AND lower(email) = v_email
  LIMIT 1;

  IF v_role IS NULL THEN
    SELECT role INTO v_role
    FROM admin_allowlist
    WHERE domain IS NOT NULL AND lower(domain) = v_domain
    LIMIT 1;
  END IF;

  IF v_role IS NULL THEN
    RETURN false;
  END IF;

  -- Resolve the target organization: prefer the canonical Boxed2Built org.
  SELECT id INTO v_org_id FROM organizations WHERE slug = 'boxed2built' LIMIT 1;
  IF v_org_id IS NULL THEN
    SELECT id INTO v_org_id FROM organizations WHERE is_active = true ORDER BY created_at LIMIT 1;
  END IF;

  IF v_org_id IS NULL THEN
    RETURN false;
  END IF;

  INSERT INTO organization_members (user_id, organization_id, role, is_active)
  VALUES (v_user_id, v_org_id, v_role, true)
  ON CONFLICT (user_id, organization_id)
  DO UPDATE SET is_active = true, role = EXCLUDED.role;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION claim_admin_membership() TO authenticated;

-- =====================================================
-- Step 4: one-time backfill for existing users
-- =====================================================

DO $$
DECLARE
  v_org_id uuid;
  r RECORD;
BEGIN
  SELECT id INTO v_org_id FROM organizations WHERE slug = 'boxed2built' LIMIT 1;
  IF v_org_id IS NULL THEN
    SELECT id INTO v_org_id FROM organizations WHERE is_active = true ORDER BY created_at LIMIT 1;
  END IF;

  IF v_org_id IS NULL THEN
    RAISE NOTICE 'No organization found; skipping allowlist backfill.';
    RETURN;
  END IF;

  FOR r IN
    SELECT u.id AS user_id,
           COALESCE(
             (SELECT a.role FROM admin_allowlist a
              WHERE a.email IS NOT NULL AND lower(a.email) = lower(u.email) LIMIT 1),
             (SELECT a.role FROM admin_allowlist a
              WHERE a.domain IS NOT NULL AND lower(a.domain) = split_part(lower(u.email), '@', 2) LIMIT 1)
           ) AS matched_role
    FROM auth.users u
    WHERE u.email IS NOT NULL
  LOOP
    IF r.matched_role IS NOT NULL THEN
      INSERT INTO organization_members (user_id, organization_id, role, is_active)
      VALUES (r.user_id, v_org_id, r.matched_role, true)
      ON CONFLICT (user_id, organization_id)
      DO UPDATE SET is_active = true, role = EXCLUDED.role;
    END IF;
  END LOOP;
END $$;
