/*
  # External Resource ID on Connections

  1. Changes
    - Adds `external_resource_id` (text) to `integration_connections` — a
      general-purpose cache slot for a resolved external resource name that
      isn't known at connect time and would otherwise require a lookup call
      on every use. First use: Google Business Profile's location resource
      name (e.g. `locations/12345`), discovered once via a locations-list
      call and reused by `sync-google-business-profile` on every subsequent
      sync instead of re-resolving it each time.
*/

ALTER TABLE integration_connections
  ADD COLUMN IF NOT EXISTS external_resource_id text;
