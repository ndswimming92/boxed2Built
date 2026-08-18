/*
  # Filament options for the print shop

  The product form's Material and Color fields were free text, so every product
  was a chance to typo "PETG" or invent a third spelling of "matte black". They
  become dropdowns fed by lists the shop owner maintains in Store settings,
  reflecting the filament actually on hand.

  1. Schema Changes
    - `shop_settings.material_options` (jsonb, array of text) — filament types
      offered in the product form's Material dropdown.
    - `shop_settings.color_options` (jsonb, array of text) — colors offered in
      the product form's Color dropdown.

  2. Notes
    - Products keep storing plain text in `shop_products.material` / `.color`,
      so existing rows stay valid and removing an option never rewrites the
      products that used it. The form surfaces such a value as an extra choice
      so editing a product can't silently drop it.
    - Seeded with common Bambu Lab filaments so the dropdowns aren't empty on
      first use; the owner edits both lists from Store settings.
    - No RLS changes: these are two more columns on a row the public can
      already read (the storefront reads shipping and pickup settings from it),
      and only admins/org members can write.
*/

ALTER TABLE shop_settings
  ADD COLUMN IF NOT EXISTS material_options jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE shop_settings
  ADD COLUMN IF NOT EXISTS color_options jsonb NOT NULL DEFAULT '[]'::jsonb;

UPDATE shop_settings
SET material_options = '["PLA","PLA Matte","PLA Silk","PETG","TPU","ABS","ASA"]'::jsonb
WHERE material_options = '[]'::jsonb;

UPDATE shop_settings
SET color_options = '["Matte Black","White","Gray","Red","Blue","Green","Orange","Wood"]'::jsonb
WHERE color_options = '[]'::jsonb;
