/*
# Leave-by time for scheduled jobs

1. Changes
  - `travel_settings.departure_buffer_minutes` — padding added on top of the
    Mapbox drive time when working out when to leave. Loading the truck, parking
    and a traffic cushion are not part of the route estimate, so a leave-by built
    from drive time alone is always a little late.

2. Notes
  - Defaults to 15 minutes, which is the cushion assumed before this column
    existed. 0 is allowed and means "leave-by is exactly the drive time".
  - Capped at 240 so a typo (240 vs 24) cannot push a leave-by into the previous
    day without it being obvious on the settings page.
*/

ALTER TABLE travel_settings
  ADD COLUMN IF NOT EXISTS departure_buffer_minutes integer NOT NULL DEFAULT 15;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'travel_settings_departure_buffer_check'
  ) THEN
    ALTER TABLE travel_settings
      ADD CONSTRAINT travel_settings_departure_buffer_check
      CHECK (departure_buffer_minutes >= 0 AND departure_buffer_minutes <= 240);
  END IF;
END $$;

COMMENT ON COLUMN travel_settings.departure_buffer_minutes IS
  'Minutes added to the Mapbox drive time when computing a job''s leave-by time. Covers loading, parking and traffic variance, none of which the route estimate includes.';
