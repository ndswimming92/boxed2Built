/*
  # Fix clients self-referential FK for safe permanent deletion

  ## Purpose
  Alters the `clients.referred_by_client_id` foreign key from NO ACTION (default)
  to ON DELETE SET NULL. This allows an admin to permanently delete a client record
  even when that client has referred others — the referred clients remain intact,
  their `referred_by_client_id` column is simply nulled out.

  ## Changes
  - `clients.referred_by_client_id` FK: NO ACTION → SET NULL on delete

  ## Safety
  - No data is dropped or modified
  - Referred client records are preserved; only the referral attribution pointer is cleared
*/

ALTER TABLE clients
  DROP CONSTRAINT IF EXISTS clients_referred_by_client_id_fkey;

ALTER TABLE clients
  ADD CONSTRAINT clients_referred_by_client_id_fkey
    FOREIGN KEY (referred_by_client_id)
    REFERENCES clients(id)
    ON DELETE SET NULL;
