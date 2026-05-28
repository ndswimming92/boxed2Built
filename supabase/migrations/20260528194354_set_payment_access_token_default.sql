/*
  # Set default value for payment_access_token on invoices

  ## Summary
  Adds a database-level DEFAULT to the `payment_access_token` column so that
  new invoice rows automatically receive a unique random token without requiring
  the application code to supply one.

  ## Changes
  - `invoices.payment_access_token`: adds DEFAULT gen_random_uuid()::text

  ## Notes
  - Fixes "null value in column payment_access_token violates not-null constraint"
    error that occurs when creating invoices via the admin UI.
  - Existing rows are unaffected (they already have tokens from the backfill).
*/

ALTER TABLE invoices ALTER COLUMN payment_access_token SET DEFAULT gen_random_uuid()::text;
