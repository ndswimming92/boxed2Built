/*
  # Make Invoice Client Email Optional
  
  ## Change
  - Modify the `invoices` table to allow NULL values for `client_email`
  
  ## Reason
  Some invoices may not have an email address for the client, especially for 
  cash customers or when only phone contact is available.
*/

-- Make client_email nullable
ALTER TABLE invoices 
ALTER COLUMN client_email DROP NOT NULL;