/*
  # Social conversation archive

  1. New Tables
    - `social_conversation_archive` - lets an admin hide a Messenger/Instagram
      DM conversation from the Direct Messages "Needs Reply" view and badge
      count (e.g. one Meta's 24-hour reply window has closed on) without
      touching anything on Meta's side — this is purely local bookkeeping.
      - `id` (uuid, primary key)
      - `conversation_id` (text, required, unique) - Graph API conversation id
      - `platform` (text, required) - facebook | instagram
      - `archived_by` (uuid, references auth.users)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS
    - Platform admins have full access (same pattern as integration_connections)
*/

CREATE TABLE IF NOT EXISTS social_conversation_archive (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id text NOT NULL UNIQUE,
  platform text NOT NULL CHECK (platform IN ('facebook', 'instagram')),
  archived_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_social_conversation_archive_conversation_id
  ON social_conversation_archive(conversation_id);

ALTER TABLE social_conversation_archive ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins have full access to social_conversation_archive"
  ON social_conversation_archive FOR ALL TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());
