/*
  # Gallery Item Purpose (Website / Social / Both)

  1. Changes to `gallery_items`
    - `show_on_website` (boolean, default true) - whether this item appears
      on the public /gallery page. Distinct from `is_active`, which is a
      separate temporary-hide / soft-delete flag — an item can be
      `is_active = true` (not soft-deleted) but `show_on_website = false`
      (never meant for the public gallery, only social).
    - `eligible_for_social` (boolean, default true) - whether the "Post to
      Social" button is offered for this item at all.

    Together these represent the three purposes an admin picks per item:
    Website Gallery Only (show_on_website=true, eligible_for_social=false),
    Social Media Only (show_on_website=false, eligible_for_social=true), or
    Both (both true). Defaulting both to true preserves current behavior for
    every existing row.

  2. Security
    - The anon SELECT policy on `gallery_items` now also requires
      `show_on_website = true`, so social-only items are excluded from the
      public gallery at the database level, not just by client-side query
      filtering.
*/

ALTER TABLE gallery_items
  ADD COLUMN IF NOT EXISTS show_on_website boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS eligible_for_social boolean NOT NULL DEFAULT true;

DROP POLICY IF EXISTS "Anon select active gallery items" ON public.gallery_items;
CREATE POLICY "Anon select active gallery items"
  ON public.gallery_items FOR SELECT TO anon
  USING (is_active = true AND show_on_website = true);
