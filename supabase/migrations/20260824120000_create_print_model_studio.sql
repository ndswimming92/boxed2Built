/*
  # Print Model Studio

  Admin-only tool that turns a typed idea into a print-ready file. Claude writes
  parametric OpenSCAD source; the browser compiles it to STL with openscad-wasm
  (see `src/lib/openscad/`), renders a preview, and exports STL / 3MF / .scad.

  Nothing here is public. Model source is business IP, so the storage bucket is
  private and downloads go through short-lived signed URLs — the same posture as
  `portal-document-vault`, not `shop-images`.

  1. New Tables
    - `print_models` — one row per idea
      - `id` (uuid, pk)
      - `business_id` (uuid, references business_info)
      - `organization_id` (uuid, references organizations)
      - `created_by` (uuid, references auth.users) — who typed the prompt
      - `name` (text) — Claude-supplied, admin-editable
      - `prompt` (text) — the original idea, kept verbatim for re-runs
      - `summary` (text) — one-line description of what was built
      - `status` (text) — `draft | ready | archived`
      - `current_version_id` (uuid) — points at the version being shown
      - `tags` (text[]) — free-form grouping for the library filter
      - `created_at`, `updated_at` (timestamptz)

    - `print_model_versions` — one row per generation, refinement or repair turn
      - `scad_source` (text) — the parametric source; the real artifact
      - `parameters` (jsonb) — Customizer descriptors driving the slider UI
      - `param_values` (jsonb) — current slider overrides
      - `refine_prompt` (text) — null on v1, the change request thereafter
      - `claude_model`, `claude_input_tokens`, `claude_output_tokens` — spend
        tracking, so this surfaces on `/admin/claude-usage` like everything else
      - `compile_status` (text) — `pending | ok | failed`
      - `compile_error` (text) — OpenSCAD stderr, fed back to Claude on repair
      - `repair_attempts` (integer) — capped client-side at 3
      - `stl_path`, `threemf_path`, `scad_path`, `preview_path` (text)
      - `metrics` (jsonb) — bbox, triangle count, volume, watertightness,
        overhang histogram, filament estimate
      - `print_profile` (jsonb) — printer preset, nozzle, layer height, material

  2. Security
    - RLS on both tables. Platform admins have full access; organization members
      with `member` or above get the same through `has_org_permission()`.
    - No `anon` policy at all, plus an explicit REVOKE — this is admin tooling.
    - Storage bucket `print-models` is PRIVATE; read and write both require
      `is_platform_admin()`.

  3. Indexes
    - Every foreign key is indexed, and the library list is ordered by
      `updated_at DESC` so that gets a composite with `business_id`.
*/

-- ── Tables ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS print_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES business_info(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL DEFAULT 'Untitled model',
  prompt text NOT NULL,
  summary text,
  status text NOT NULL DEFAULT 'draft',
  current_version_id uuid,
  tags text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT print_models_status_check
    CHECK (status IN ('draft', 'ready', 'archived'))
);

CREATE TABLE IF NOT EXISTS print_model_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id uuid NOT NULL REFERENCES print_models(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  version integer NOT NULL DEFAULT 1,
  parent_version_id uuid REFERENCES print_model_versions(id) ON DELETE SET NULL,
  scad_source text NOT NULL,
  parameters jsonb NOT NULL DEFAULT '[]'::jsonb,
  param_values jsonb NOT NULL DEFAULT '{}'::jsonb,
  refine_prompt text,
  claude_model text,
  claude_input_tokens integer NOT NULL DEFAULT 0,
  claude_output_tokens integer NOT NULL DEFAULT 0,
  compile_status text NOT NULL DEFAULT 'pending',
  compile_error text,
  repair_attempts integer NOT NULL DEFAULT 0,
  stl_path text,
  threemf_path text,
  scad_path text,
  preview_path text,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  print_profile jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT print_model_versions_compile_status_check
    CHECK (compile_status IN ('pending', 'ok', 'failed')),
  CONSTRAINT print_model_versions_unique_version UNIQUE (model_id, version)
);

-- `current_version_id` is added after both tables exist so the FK can resolve.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'print_models_current_version_fkey'
  ) THEN
    ALTER TABLE print_models
      ADD CONSTRAINT print_models_current_version_fkey
      FOREIGN KEY (current_version_id)
      REFERENCES print_model_versions(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ── Indexes (every FK, plus the library ordering) ────────────────────────────
CREATE INDEX IF NOT EXISTS idx_print_models_business_updated
  ON print_models (business_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_print_models_organization
  ON print_models (organization_id);
CREATE INDEX IF NOT EXISTS idx_print_models_created_by
  ON print_models (created_by);
CREATE INDEX IF NOT EXISTS idx_print_models_current_version
  ON print_models (current_version_id);
CREATE INDEX IF NOT EXISTS idx_print_models_status
  ON print_models (status);

CREATE INDEX IF NOT EXISTS idx_print_model_versions_model
  ON print_model_versions (model_id, version DESC);
CREATE INDEX IF NOT EXISTS idx_print_model_versions_organization
  ON print_model_versions (organization_id);
CREATE INDEX IF NOT EXISTS idx_print_model_versions_parent
  ON print_model_versions (parent_version_id);

-- ── updated_at trigger ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_print_model_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS print_models_updated_at ON print_models;
CREATE TRIGGER print_models_updated_at
  BEFORE UPDATE ON print_models
  FOR EACH ROW
  EXECUTE FUNCTION update_print_model_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE print_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE print_model_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform admins have full access to print models" ON print_models;
CREATE POLICY "Platform admins have full access to print models"
  ON print_models FOR ALL TO authenticated
  USING (is_platform_admin()) WITH CHECK (is_platform_admin());

DROP POLICY IF EXISTS "Organization members can manage print models" ON print_models;
CREATE POLICY "Organization members can manage print models"
  ON print_models FOR ALL TO authenticated
  USING (has_org_permission(organization_id, 'member'))
  WITH CHECK (has_org_permission(organization_id, 'member'));

DROP POLICY IF EXISTS "Platform admins have full access to print model versions" ON print_model_versions;
CREATE POLICY "Platform admins have full access to print model versions"
  ON print_model_versions FOR ALL TO authenticated
  USING (is_platform_admin()) WITH CHECK (is_platform_admin());

DROP POLICY IF EXISTS "Organization members can manage print model versions" ON print_model_versions;
CREATE POLICY "Organization members can manage print model versions"
  ON print_model_versions FOR ALL TO authenticated
  USING (has_org_permission(organization_id, 'member'))
  WITH CHECK (has_org_permission(organization_id, 'member'));

-- ── Grants: admin tooling is never reachable anonymously ─────────────────────
REVOKE ALL ON print_models FROM anon;
REVOKE ALL ON print_model_versions FROM anon;

-- ── Private storage bucket for generated model files ─────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('print-models', 'print-models', false)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects' AND policyname = 'Admins can read print model files'
  ) THEN
    CREATE POLICY "Admins can read print model files"
      ON storage.objects FOR SELECT TO authenticated
      USING (bucket_id = 'print-models' AND public.is_platform_admin());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects' AND policyname = 'Admins can upload print model files'
  ) THEN
    CREATE POLICY "Admins can upload print model files"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'print-models' AND public.is_platform_admin());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects' AND policyname = 'Admins can update print model files'
  ) THEN
    CREATE POLICY "Admins can update print model files"
      ON storage.objects FOR UPDATE TO authenticated
      USING (bucket_id = 'print-models' AND public.is_platform_admin())
      WITH CHECK (bucket_id = 'print-models' AND public.is_platform_admin());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects' AND policyname = 'Admins can delete print model files'
  ) THEN
    CREATE POLICY "Admins can delete print model files"
      ON storage.objects FOR DELETE TO authenticated
      USING (bucket_id = 'print-models' AND public.is_platform_admin());
  END IF;
END $$;

-- STL/3MF payloads are larger than image uploads; cap them so a runaway model
-- cannot fill the bucket.
UPDATE storage.buckets
SET file_size_limit = 104857600
WHERE id = 'print-models';
