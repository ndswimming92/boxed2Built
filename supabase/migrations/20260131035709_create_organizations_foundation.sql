/*
  # Create Organizations and Multi-Tenant Foundation

  ## Overview
  This migration establishes the foundation for multi-tenant organization management 
  with role-based access control. It creates organizations and membership tables, 
  initializes the first "Boxed2Built" organization from existing business data, 
  and assigns the first user as the organization owner.

  ## New Tables Created

  ### 1. organizations
  - `id` (uuid, primary key) - Unique organization identifier
  - `name` (text, NOT NULL) - Organization display name
  - `slug` (text, UNIQUE, NOT NULL) - URL-safe identifier for organization
  - `created_at` (timestamptz) - Organization creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp
  - `is_active` (boolean) - Whether organization is active

  ### 2. organization_members
  - `id` (uuid, primary key) - Unique membership identifier
  - `user_id` (uuid, FK to auth.users) - Reference to user
  - `organization_id` (uuid, FK to organizations) - Reference to organization
  - `role` (organization_role enum) - User's role in organization
  - `invited_at` (timestamptz) - When user was invited
  - `joined_at` (timestamptz) - When user joined
  - `is_active` (boolean) - Whether membership is active

  ## Role Hierarchy
  - `owner` - Full access, can manage all settings and members
  - `admin` - Can manage configuration and operational data
  - `member` - Can manage operational data (jobs, invoices, etc.)
  - `viewer` - Read-only access to organization data

  ## Security Implementation
  - Row Level Security (RLS) enabled on all tables
  - Unique constraint on user_id + organization_id to prevent duplicates
  - Indexes on foreign keys for RLS query performance
  - Platform admin capability via auth.users app_metadata

  ## Initial Data
  - Creates "Boxed2Built" organization from existing business_info
  - Assigns first user in auth.users as organization owner
  - Auto-activates organization for immediate use
*/

-- Create organization_role enum type
DO $$ BEGIN
  CREATE TYPE organization_role AS ENUM ('viewer', 'member', 'admin', 'owner');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create organizations table
CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  is_active boolean DEFAULT true
);

-- Create organization_members table
CREATE TABLE IF NOT EXISTS organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role organization_role NOT NULL DEFAULT 'member',
  invited_at timestamptz DEFAULT now(),
  joined_at timestamptz DEFAULT now(),
  is_active boolean DEFAULT true,
  UNIQUE(user_id, organization_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_organization_members_user_id ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_organization_members_organization_id ON organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_members_role ON organization_members(organization_id, role);
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);
CREATE INDEX IF NOT EXISTS idx_organizations_active ON organizations(is_active);

-- Enable Row Level Security
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;

-- RLS Policies for organizations
CREATE POLICY "Users can view their organizations"
  ON organizations FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Organization admins can update their organization"
  ON organizations FOR UPDATE
  TO authenticated
  USING (
    id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'owner')
      AND is_active = true
    )
  )
  WITH CHECK (
    id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'owner')
      AND is_active = true
    )
  );

CREATE POLICY "Authenticated users can create organizations"
  ON organizations FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- RLS Policies for organization_members
CREATE POLICY "Users can view members of their organizations"
  ON organization_members FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Organization admins can manage members"
  ON organization_members FOR ALL
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'owner')
      AND is_active = true
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'owner')
      AND is_active = true
    )
  );

-- Create trigger for updated_at
CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Initialize Boxed2Built organization from existing business data
DO $$
DECLARE
  v_org_id uuid;
  v_user_id uuid;
  v_business_name text;
BEGIN
  -- Get existing business name or use default
  SELECT name INTO v_business_name FROM business_info WHERE is_active = true LIMIT 1;
  IF v_business_name IS NULL THEN
    v_business_name := 'Boxed2Built';
  END IF;

  -- Insert Boxed2Built organization
  INSERT INTO organizations (name, slug, is_active)
  VALUES (v_business_name, 'boxed2built', true)
  ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO v_org_id;

  -- Get first user from auth.users
  SELECT id INTO v_user_id FROM auth.users ORDER BY created_at LIMIT 1;

  -- Assign first user as owner if user exists
  IF v_user_id IS NOT NULL THEN
    INSERT INTO organization_members (user_id, organization_id, role, is_active)
    VALUES (v_user_id, v_org_id, 'owner', true)
    ON CONFLICT (user_id, organization_id) DO UPDATE 
    SET role = 'owner', is_active = true;
  END IF;

  -- Log the initialization
  RAISE NOTICE 'Initialized organization "%" with id % and owner %', v_business_name, v_org_id, v_user_id;
END $$;
