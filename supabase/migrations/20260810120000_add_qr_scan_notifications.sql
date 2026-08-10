/*
  # QR Scan Email Notifications

  ## Overview
  Adds per-QR-code notification settings plus the extra scan telemetry the
  `notify-qr-scan` edge function collects, so every scan can be emailed to the
  business with the code's identity, its running scan total, and what could be
  determined about the scanning device.

  ## Changes

  ### `qr_codes`
  - `notify_on_scan` (boolean, default true) - send an email on every scan of
    this code. Turn it off per-code for a high-traffic code instead of
    disabling notifications globally.
  - `notification_email` (text, nullable) - recipient override. When null or
    blank the edge function falls back to the `QR_SCAN_NOTIFY_EMAIL` env var,
    then to the standard owner address.

  ### `qr_scans`
  - `destination_url` (text) - the URL this scan actually forwarded to, so a
    scheduled redirect can be told apart from the default destination.
  - `region` (text) - state/region resolved from the IP, when available.
  - `timezone` (text) - the device's IANA timezone (e.g. America/Chicago).
  - `language` (text) - the device's preferred language.
  - `screen_resolution` (text) - screen size and pixel ratio.
  - `device_model` (text) - device model from UA client hints, when the browser
    exposes it (Android/Chromium).
  - `os_version` / `browser_version` (text) - version detail the plain
    user-agent string alone does not reliably give.
  - `is_bot` (boolean, default false) - link previewers and crawlers. These are
    still recorded for analytics but never trigger an email.
  - `notification_sent_at` (timestamptz, nullable) - when the scan email went
    out. Null means no email was sent for that scan, and the column doubles as
    the window the hourly notification cap is measured over.

  ## Security
  Existing RLS policies on these tables continue to apply unchanged. The edge
  function writes with the service role, so no new policy is required. The
  existing anon INSERT policy on `qr_scans` is left in place so browsers still
  running an older cached bundle keep logging scans.

  Anonymous visitors can read active `qr_codes` rows in order to resolve a
  redirect, so `notification_email` would otherwise be publicly readable. This
  migration revokes column-level SELECT on it from `anon`, which also means an
  anonymous `select('*')` on the table is rejected outright - the public
  redirect path selects an explicit column list instead.

  ## Notes
  All columns are added with `IF NOT EXISTS` and safe defaults, so the
  migration is idempotent and needs no backfill: existing scan rows keep their
  values and simply carry empty telemetry.
*/

-- qr_codes: per-code notification settings
ALTER TABLE qr_codes
  ADD COLUMN IF NOT EXISTS notify_on_scan boolean NOT NULL DEFAULT true;

ALTER TABLE qr_codes
  ADD COLUMN IF NOT EXISTS notification_email text;

COMMENT ON COLUMN qr_codes.notify_on_scan IS
  'Email the business every time this QR code is scanned.';

COMMENT ON COLUMN qr_codes.notification_email IS
  'Optional recipient override for scan emails. Falls back to the QR_SCAN_NOTIFY_EMAIL edge function secret when null or blank.';

-- Keep the notification recipient out of the publicly readable redirect row.
--
-- A column-level REVOKE alone is a no-op here: anon holds a table-wide SELECT
-- grant on qr_codes, which covers every column including ones added later. The
-- table-level grant has to be dropped first, then SELECT re-granted on exactly
-- the columns the public /go/{slug} redirect reads. A consequence worth knowing:
-- columns added to qr_codes from now on are not readable by anon until granted
-- here, and an anonymous select('*') is rejected outright.
REVOKE SELECT ON qr_codes FROM anon;
GRANT SELECT (id, slug, title, default_destination_url, status) ON qr_codes TO anon;

-- qr_scans: richer per-scan telemetry
ALTER TABLE qr_scans
  ADD COLUMN IF NOT EXISTS destination_url text DEFAULT '';

ALTER TABLE qr_scans
  ADD COLUMN IF NOT EXISTS region text DEFAULT '';

ALTER TABLE qr_scans
  ADD COLUMN IF NOT EXISTS timezone text DEFAULT '';

ALTER TABLE qr_scans
  ADD COLUMN IF NOT EXISTS language text DEFAULT '';

ALTER TABLE qr_scans
  ADD COLUMN IF NOT EXISTS screen_resolution text DEFAULT '';

ALTER TABLE qr_scans
  ADD COLUMN IF NOT EXISTS device_model text DEFAULT '';

ALTER TABLE qr_scans
  ADD COLUMN IF NOT EXISTS os_version text DEFAULT '';

ALTER TABLE qr_scans
  ADD COLUMN IF NOT EXISTS browser_version text DEFAULT '';

ALTER TABLE qr_scans
  ADD COLUMN IF NOT EXISTS is_bot boolean NOT NULL DEFAULT false;

ALTER TABLE qr_scans
  ADD COLUMN IF NOT EXISTS notification_sent_at timestamptz;

COMMENT ON COLUMN qr_scans.destination_url IS
  'URL this scan forwarded to - the active schedule destination when one matched, otherwise the default.';

COMMENT ON COLUMN qr_scans.is_bot IS
  'Scan came from a crawler or link previewer. Recorded for analytics, never emailed.';

COMMENT ON COLUMN qr_scans.notification_sent_at IS
  'When the scan notification email was sent. Null means no email was sent for this scan.';
