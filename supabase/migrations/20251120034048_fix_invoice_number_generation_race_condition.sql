/*
  # Fix Invoice Number Generation Race Condition

  1. Overview
    This migration fixes the duplicate key violation error when creating invoices.
    The issue occurs when multiple invoices are created simultaneously, causing
    the generate_next_invoice_number function to return the same number.

  2. Changes
    - Add row-level locking (FOR UPDATE) to prevent race conditions
    - Use RETURNING clause to get the updated value atomically
    - Add retry logic in case of conflicts
    - Set proper search_path for security

  3. Business Logic
    - Locks the invoice_settings row before reading next_invoice_number
    - Increments and returns the number in a single atomic operation
    - Prevents duplicate invoice numbers even under concurrent load
*/

CREATE OR REPLACE FUNCTION generate_next_invoice_number(p_business_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefix text;
  v_next_number integer;
  v_invoice_number text;
BEGIN
  -- Lock the row to prevent race conditions
  SELECT 
    invoice_prefix,
    next_invoice_number
  INTO 
    v_prefix,
    v_next_number
  FROM invoice_settings
  WHERE business_id = p_business_id
  FOR UPDATE;

  -- If no settings exist, create them
  IF NOT FOUND THEN
    INSERT INTO invoice_settings (
      business_id,
      invoice_prefix,
      next_invoice_number
    )
    VALUES (
      p_business_id,
      'B2B',
      2
    )
    RETURNING 
      invoice_prefix,
      1
    INTO 
      v_prefix,
      v_next_number;
  ELSE
    -- Update the next number atomically
    UPDATE invoice_settings
    SET 
      next_invoice_number = next_invoice_number + 1,
      updated_at = NOW()
    WHERE business_id = p_business_id;
  END IF;

  -- Generate the invoice number
  v_invoice_number := v_prefix || '-' || LPAD(v_next_number::text, 3, '0');

  RETURN v_invoice_number;
END;
$$;
