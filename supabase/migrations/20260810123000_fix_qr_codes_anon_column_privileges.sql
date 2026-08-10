/*
  # Actually restrict anon reads of qr_codes.notification_email

  ## Why this exists
  `20260810120000_add_qr_scan_notifications.sql` tried to hide the new
  `notification_email` column from anonymous visitors with:

      REVOKE SELECT (notification_email) ON qr_codes FROM anon;

  That statement succeeds but changes nothing. `anon` holds a *table-level*
  SELECT grant on `qr_codes`, which implicitly covers every column - including
  columns added afterwards - and a column-level revoke cannot carve an
  exception out of a table-wide grant. `information_schema.column_privileges`
  confirmed `anon` still had SELECT on `notification_email` after that
  migration ran.

  The earlier migration has been corrected in place for fresh environments.
  This migration applies the same fix to databases that already ran the
  ineffective version. Both are idempotent, so running them in sequence is
  safe.

  ## Changes
  - Drop the table-wide SELECT grant on `qr_codes` from `anon`.
  - Re-grant SELECT to `anon` on only the columns the public `/go/{slug}`
    redirect reads: `id`, `slug`, `title`, `default_destination_url`, `status`.

  ## Consequences
  - `notification_email` is no longer readable by anonymous visitors.
  - Internal fields (`description`, `business_id`, `organization_id`,
    `notify_on_scan`, timestamps) are no longer exposed publicly either.
  - An anonymous `select('*')` on `qr_codes` is now rejected. The public
    redirect selects an explicit column list, which is the only anon read path;
    every other reader is an authenticated admin, and the notify-qr-scan edge
    function uses the service role.
  - Columns added to `qr_codes` in future are private to anon by default and
    must be granted explicitly here if the public redirect needs them.
*/

REVOKE SELECT ON qr_codes FROM anon;

GRANT SELECT (id, slug, title, default_destination_url, status) ON qr_codes TO anon;
