/*
  # Track Facebook/Instagram posts removed after publishing

  1. Changes to `gallery_items`
    - `facebook_post_removed_at` (timestamptz) - set once `check-social-post-status`
      confirms the published Facebook post no longer resolves (deleted, or taken
      down by Facebook for spam/policy reasons)
    - `facebook_post_removed_reason` (text) - the Graph API error message that
      indicated the removal
    - `instagram_post_removed_at` (timestamptz) - same, for the Instagram media
    - `instagram_post_removed_reason` (text)

    Written only by the `check-social-post-status` edge function (service role)
    and cleared by `publish-gallery-photo` / `run-scheduled-social-posts` when a
    photo is republished, so no RLS changes are needed.
*/

ALTER TABLE gallery_items
  ADD COLUMN IF NOT EXISTS facebook_post_removed_at timestamptz,
  ADD COLUMN IF NOT EXISTS facebook_post_removed_reason text,
  ADD COLUMN IF NOT EXISTS instagram_post_removed_at timestamptz,
  ADD COLUMN IF NOT EXISTS instagram_post_removed_reason text;
