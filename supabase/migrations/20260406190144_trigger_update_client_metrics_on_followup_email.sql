/*
  # Auto-refresh client metrics when follow-up email timestamp changes

  ## Summary
  Adds a BEFORE UPDATE trigger on the `clients` table that automatically calls
  `update_client_metrics` whenever `last_followup_email_sent_at` is set or changed.
  This ensures `last_contact_date` is immediately updated to reflect the email send
  without requiring any other job/invoice change to trigger the recalculation.

  ## Changes
  - New trigger function: `trigger_refresh_metrics_on_followup_email`
  - New trigger: `refresh_metrics_on_followup_email_update`
    - Fires AFTER UPDATE on `clients`
    - Only executes when `last_followup_email_sent_at` actually changes

  ## Important Notes
  1. Uses AFTER UPDATE (not BEFORE) so the new value is already committed to the
     row when `update_client_metrics` reads it back.
  2. The trigger guard (`NEW.last_followup_email_sent_at IS DISTINCT FROM OLD.last_followup_email_sent_at`)
     prevents infinite recursion — `update_client_metrics` updates `last_contact_date`
     and `updated_at` on the same row, but those columns are NOT `last_followup_email_sent_at`,
     so the trigger does not fire again.
*/

CREATE OR REPLACE FUNCTION trigger_refresh_metrics_on_followup_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.last_followup_email_sent_at IS DISTINCT FROM OLD.last_followup_email_sent_at THEN
    PERFORM update_client_metrics(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS refresh_metrics_on_followup_email_update ON clients;

CREATE TRIGGER refresh_metrics_on_followup_email_update
  AFTER UPDATE ON clients
  FOR EACH ROW
  EXECUTE FUNCTION trigger_refresh_metrics_on_followup_email();
