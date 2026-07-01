-- Trigger function: when a client's name, email, or phone changes,
-- propagate those changes to all linked jobs, form_inquiries, and invoices.
CREATE OR REPLACE FUNCTION public.propagate_client_contact_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update jobs linked to this client
  IF OLD.name IS DISTINCT FROM NEW.name
     OR OLD.email IS DISTINCT FROM NEW.email
     OR OLD.phone IS DISTINCT FROM NEW.phone THEN

    UPDATE jobs
    SET
      client_name  = NEW.name,
      client_email = NEW.email,
      client_phone = NEW.phone
    WHERE client_id = NEW.id;

    UPDATE form_inquiries
    SET
      client_name  = NEW.name,
      client_email = COALESCE(NEW.email, client_email),
      client_phone = NEW.phone
    WHERE client_id = NEW.id;

    UPDATE invoices
    SET
      client_name  = NEW.name,
      client_email = NEW.email,
      client_phone = NEW.phone
    WHERE client_id = NEW.id;

  END IF;

  RETURN NEW;
END;
$$;

-- Attach trigger to clients table (fires only when contact fields actually change)
DROP TRIGGER IF EXISTS trg_propagate_client_contact_changes ON clients;
CREATE TRIGGER trg_propagate_client_contact_changes
  AFTER UPDATE ON clients
  FOR EACH ROW
  WHEN (
    OLD.name IS DISTINCT FROM NEW.name
    OR OLD.email IS DISTINCT FROM NEW.email
    OR OLD.phone IS DISTINCT FROM NEW.phone
  )
  EXECUTE FUNCTION propagate_client_contact_changes();

-- Backfill: sync all existing linked records to their client's current info
UPDATE jobs j
SET
  client_name  = c.name,
  client_email = c.email,
  client_phone = c.phone
FROM clients c
WHERE j.client_id = c.id
  AND (
    j.client_name IS DISTINCT FROM c.name
    OR j.client_email IS DISTINCT FROM c.email
    OR j.client_phone IS DISTINCT FROM c.phone
  );

UPDATE form_inquiries fi
SET
  client_name  = c.name,
  client_email = COALESCE(c.email, fi.client_email),
  client_phone = c.phone
FROM clients c
WHERE fi.client_id = c.id
  AND (
    fi.client_name IS DISTINCT FROM c.name
    OR fi.client_email IS DISTINCT FROM COALESCE(c.email, fi.client_email)
    OR fi.client_phone IS DISTINCT FROM c.phone
  );

UPDATE invoices i
SET
  client_name  = c.name,
  client_email = c.email,
  client_phone = c.phone
FROM clients c
WHERE i.client_id = c.id
  AND (
    i.client_name IS DISTINCT FROM c.name
    OR i.client_email IS DISTINCT FROM c.email
    OR i.client_phone IS DISTINCT FROM c.phone
  );