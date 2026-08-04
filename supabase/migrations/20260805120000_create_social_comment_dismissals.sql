/*
  # Social Comment Dismissals

  Some Facebook posts hit a Graph API quirk where comment content can't be
  loaded — `get-social-comments` surfaces those as a "N comments, open the
  post to view and reply" notice instead of the actual comment text. There's
  no per-comment id to mark "replied" for that case, so instead the admin can
  dismiss the whole notice from the admin UI (clicking "View post"), which is
  recorded here and reapplied by `get-social-comments` until Facebook reports
  a higher comment count than what was dismissed (i.e. new comments came in).

  1. New table `social_comment_dismissals`
    - `platform` (text) - 'facebook' or 'instagram'
    - `post_id` (text) - the platform's post/media id
    - `dismissed_count` (integer) - the comment count at the time of dismissal
    - `dismissed_at` (timestamptz)
    - `dismissed_by` (uuid) - the admin user who dismissed it
    - unique on (platform, post_id)

    RLS is enabled with no policies — only the service role (used by the
    `get-social-comments` / `dismiss-social-notice` edge functions) can read
    or write this table.
*/

CREATE TABLE IF NOT EXISTS social_comment_dismissals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL CHECK (platform IN ('facebook', 'instagram')),
  post_id text NOT NULL,
  dismissed_count integer NOT NULL DEFAULT 0,
  dismissed_at timestamptz NOT NULL DEFAULT now(),
  dismissed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (platform, post_id)
);

ALTER TABLE social_comment_dismissals ENABLE ROW LEVEL SECURITY;
