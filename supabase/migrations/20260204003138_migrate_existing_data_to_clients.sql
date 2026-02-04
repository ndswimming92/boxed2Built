/*
  # Migrate Existing Data to Clients Table

  ## Overview
  This migration consolidates client data from form_inquiries, jobs, and invoices tables
  into the new clients table. It performs email-based deduplication and calculates initial
  client metrics.

  ## Process
  1. Add client_id columns to jobs and invoices tables
  2. Extract unique clients from form_inquiries (by email)
  3. Merge in clients from jobs table (by email and name)
  4. Merge in clients from invoices table (by client email)
  5. Update jobs table to reference client_id
  6. Update invoices table to reference client_id
  7. Calculate metrics for all clients

  ## Notes
  - Handles NULL emails by skipping those records
  - Preserves all historical data relationships
  - Sets initial source attribution where possible
  - Uses existing organization_id from records where available
*/

-- Add client_id column to jobs table if not exists
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'jobs' AND column_name = 'client_id'
  ) THEN
    ALTER TABLE jobs ADD COLUMN client_id uuid REFERENCES clients(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS jobs_client_id_idx ON jobs(client_id);
  END IF;
END $$;

-- Add client_id column to invoices table if not exists
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'invoices' AND column_name = 'client_id'
  ) THEN
    ALTER TABLE invoices ADD COLUMN client_id uuid REFERENCES clients(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS invoices_client_id_idx ON invoices(client_id);
  END IF;
END $$;

-- Now migrate the data
DO $$
DECLARE
  v_org_id uuid;
  v_client_id uuid;
  v_inquiry record;
  v_job record;
  v_invoice record;
  v_migrated_count integer := 0;
BEGIN
  -- Get default organization
  SELECT id INTO v_org_id FROM organizations ORDER BY created_at LIMIT 1;
  
  IF v_org_id IS NULL THEN
    RAISE NOTICE 'No organization found. Skipping client migration.';
    RETURN;
  END IF;

  RAISE NOTICE 'Using organization: %', v_org_id;

  -- Step 1: Migrate clients from form_inquiries
  RAISE NOTICE 'Step 1: Migrating clients from form_inquiries...';
  
  FOR v_inquiry IN 
    SELECT 
      client_email as email,
      client_name as name,
      client_phone as phone,
      organization_id,
      MIN(created_at) as first_contact,
      source,
      referral_source
    FROM form_inquiries
    WHERE client_email IS NOT NULL AND client_email != ''
    GROUP BY client_email, client_name, client_phone, organization_id, source, referral_source
    ORDER BY MIN(created_at)
  LOOP
    -- Use upsert function to create or update client
    BEGIN
      v_client_id := upsert_client_by_email(
        COALESCE(v_inquiry.organization_id, v_org_id),
        v_inquiry.email,
        v_inquiry.name,
        v_inquiry.phone,
        NULL, -- address
        COALESCE(v_inquiry.referral_source, v_inquiry.source, 'contact_form')
      );
      
      -- Update first_contact_date if this is earlier
      UPDATE clients
      SET 
        first_contact_date = LEAST(COALESCE(first_contact_date, v_inquiry.first_contact), v_inquiry.first_contact),
        last_contact_date = GREATEST(COALESCE(last_contact_date, v_inquiry.first_contact), v_inquiry.first_contact)
      WHERE id = v_client_id;
      
      v_migrated_count := v_migrated_count + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Error migrating inquiry client %: %', v_inquiry.email, SQLERRM;
    END;
  END LOOP;
  
  RAISE NOTICE 'Migrated % clients from form_inquiries', v_migrated_count;
  v_migrated_count := 0;

  -- Step 2: Migrate clients from jobs table (if not already exists)
  RAISE NOTICE 'Step 2: Migrating clients from jobs...';
  
  FOR v_job IN
    SELECT 
      client_email as email,
      client_name as name,
      client_phone as phone,
      location_city,
      organization_id,
      MIN(created_at) as first_contact
    FROM jobs
    WHERE client_email IS NOT NULL AND client_email != ''
    GROUP BY client_email, client_name, client_phone, location_city, organization_id
    ORDER BY MIN(created_at)
  LOOP
    BEGIN
      -- Use upsert function (using location_city for address)
      v_client_id := upsert_client_by_email(
        COALESCE(v_job.organization_id, v_org_id),
        v_job.email,
        v_job.name,
        v_job.phone,
        v_job.location_city,
        'job_creation'
      );
      
      -- Update jobs to reference this client
      UPDATE jobs
      SET client_id = v_client_id
      WHERE LOWER(client_email) = LOWER(v_job.email)
        AND COALESCE(organization_id, v_org_id) = COALESCE(v_job.organization_id, v_org_id);
      
      v_migrated_count := v_migrated_count + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Error migrating job client %: %', v_job.email, SQLERRM;
    END;
  END LOOP;
  
  RAISE NOTICE 'Migrated % clients from jobs', v_migrated_count;
  v_migrated_count := 0;

  -- Step 3: Migrate clients from invoices (if not already exists)
  RAISE NOTICE 'Step 3: Migrating clients from invoices...';
  
  FOR v_invoice IN
    SELECT 
      client_email as email,
      client_name as name,
      client_phone as phone,
      client_address as address,
      organization_id,
      MIN(created_at) as first_contact
    FROM invoices
    WHERE client_email IS NOT NULL AND client_email != ''
    GROUP BY client_email, client_name, client_phone, client_address, organization_id
    ORDER BY MIN(created_at)
  LOOP
    BEGIN
      -- Use upsert function
      v_client_id := upsert_client_by_email(
        COALESCE(v_invoice.organization_id, v_org_id),
        v_invoice.email,
        v_invoice.name,
        v_invoice.phone,
        v_invoice.address,
        'invoice'
      );
      
      -- Update invoices to reference this client
      UPDATE invoices
      SET client_id = v_client_id
      WHERE LOWER(client_email) = LOWER(v_invoice.email)
        AND COALESCE(organization_id, v_org_id) = COALESCE(v_invoice.organization_id, v_org_id);
      
      v_migrated_count := v_migrated_count + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Error migrating invoice client %: %', v_invoice.email, SQLERRM;
    END;
  END LOOP;
  
  RAISE NOTICE 'Migrated % clients from invoices', v_migrated_count;

  -- Step 4: Calculate metrics for all clients
  RAISE NOTICE 'Step 4: Calculating client metrics...';
  v_migrated_count := 0;
  
  FOR v_client_id IN
    SELECT id FROM clients
  LOOP
    BEGIN
      PERFORM update_client_metrics(v_client_id);
      v_migrated_count := v_migrated_count + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Error calculating metrics for client %: %', v_client_id, SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE 'Updated metrics for % clients', v_migrated_count;
  RAISE NOTICE 'Client migration complete!';
  
END $$;
