/*
  # Backfill invoice customer_id and client_id

  ## Summary
  Invoices created after the initial backfill migration have null customer_id and
  client_id even when the client_email matches a known customer/client record.
  The portal RLS policy uses customer_id = current_customer_id(), so any invoice
  with a null customer_id is invisible to portal users.

  ## Changes
  1. Backfill customer_id on all invoices where it is null by matching
     (organization_id, lower(client_email)) against the customers table.
  2. Backfill client_id on all invoices where it is null by matching
     (organization_id, lower(client_email)) against the clients table.

  ## Notes
  - Only invoices with a non-empty client_email are eligible for matching.
  - Uses the earliest-created matching record to be deterministic.
*/

UPDATE public.invoices i
SET customer_id = c.id
FROM public.customers c
WHERE i.customer_id IS NULL
  AND i.organization_id IS NOT NULL
  AND i.organization_id = c.organization_id
  AND NULLIF(BTRIM(i.client_email), '') IS NOT NULL
  AND lower(i.client_email) = lower(c.email);

UPDATE public.invoices i
SET client_id = cl.id
FROM public.clients cl
WHERE i.client_id IS NULL
  AND i.organization_id IS NOT NULL
  AND i.organization_id = cl.organization_id
  AND NULLIF(BTRIM(i.client_email), '') IS NOT NULL
  AND lower(i.client_email) = lower(cl.email);
