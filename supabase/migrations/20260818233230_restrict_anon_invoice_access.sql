/*
  # Restrict anonymous invoice access to token-checked lookups

  1. Changes
     - Drop the anon SELECT policies on `invoices` and `invoice_line_items`,
       which exposed every active invoice (including `payment_access_token`
       and customer contact detail) to any holder of the public anon key.
     - Add `get_invoice_for_payment(uuid, text)` returning only the columns the
       public payment page renders, and only when the presented payment token
       matches the stored one.
     - Add `get_invoice_receipt(uuid, text)` for the post-payment thank-you page.

  2. Security
     - Both functions are SECURITY DEFINER with a pinned search_path and are
       granted to anon and authenticated. Neither returns
       `payment_access_token`, `internal_notes` or any Stripe identifier.
*/

DROP POLICY IF EXISTS "Anon can view active invoices for payment" ON public.invoices;
DROP POLICY IF EXISTS "Anon can view line items for active invoices" ON public.invoice_line_items;

CREATE OR REPLACE FUNCTION public.get_invoice_for_payment(
  p_invoice_id uuid,
  p_token text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_invoice public.invoices%ROWTYPE;
  v_items jsonb;
BEGIN
  IF p_invoice_id IS NULL OR p_token IS NULL OR length(p_token) < 10 THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_invoice
  FROM public.invoices
  WHERE id = p_invoice_id
    AND is_active = true
    AND payment_access_token IS NOT NULL
    AND payment_access_token = p_token;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(jsonb_agg(
           jsonb_build_object(
             'id', li.id,
             'description', li.description,
             'quantity', li.quantity,
             'unit_price', li.unit_price,
             'total', li.total,
             'item_type', li.item_type,
             'is_taxable', li.is_taxable
           ) ORDER BY li.display_order
         ), '[]'::jsonb)
  INTO v_items
  FROM public.invoice_line_items li
  WHERE li.invoice_id = v_invoice.id;

  RETURN jsonb_build_object(
    'id', v_invoice.id,
    'invoice_number', v_invoice.invoice_number,
    'invoice_type', v_invoice.invoice_type,
    'client_name', v_invoice.client_name,
    'client_email', v_invoice.client_email,
    'client_phone', v_invoice.client_phone,
    'invoice_date', v_invoice.invoice_date,
    'due_date', v_invoice.due_date,
    'subtotal', v_invoice.subtotal,
    'tax_rate', v_invoice.tax_rate,
    'tax_amount', v_invoice.tax_amount,
    'total_amount', v_invoice.total_amount,
    'amount_paid', v_invoice.amount_paid,
    'amount_due', v_invoice.amount_due,
    'notes', v_invoice.notes,
    'status', v_invoice.status,
    'payment_terms', v_invoice.payment_terms,
    'business_id', v_invoice.business_id,
    'lineItems', v_items
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_invoice_receipt(
  p_invoice_id uuid,
  p_token text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_invoice public.invoices%ROWTYPE;
BEGIN
  IF p_invoice_id IS NULL OR p_token IS NULL OR length(p_token) < 10 THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_invoice
  FROM public.invoices
  WHERE id = p_invoice_id
    AND is_active = true
    AND payment_access_token IS NOT NULL
    AND payment_access_token = p_token;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'invoice_number', v_invoice.invoice_number,
    'client_name', v_invoice.client_name,
    'total_amount', v_invoice.total_amount,
    'business_id', v_invoice.business_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_invoice_for_payment(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_invoice_receipt(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_invoice_for_payment(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_invoice_receipt(uuid, text) TO anon, authenticated;
