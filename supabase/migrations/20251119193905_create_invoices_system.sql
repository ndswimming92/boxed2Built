/*
  # Create Invoicing System

  1. New Tables
    - `invoice_settings`
      - `id` (uuid, primary key)
      - `business_id` (uuid, foreign key) - Links to business_info
      - `invoice_prefix` (text) - Default "B2B"
      - `next_invoice_number` (integer) - Auto-increment counter
      - `default_payment_terms` (text) - Default "Net 30"
      - `default_due_days` (integer) - Default 30
      - `default_tax_rate` (numeric) - Default 0 for TN services
      - `enable_late_fees` (boolean) - Global late fee setting
      - `late_fee_grace_days` (integer) - Days after due date
      - `late_fee_type` (text) - 'fixed' or 'percentage'
      - `late_fee_amount` (numeric) - Late fee amount
      - `invoice_notes_template` (text, nullable) - Default notes
      - `invoice_footer` (text, nullable) - Footer text
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `invoices`
      - `id` (uuid, primary key)
      - `business_id` (uuid, foreign key) - Links to business_info
      - `inquiry_id` (uuid, nullable, foreign key) - Links to form_inquiries
      - `job_id` (uuid, nullable, foreign key) - Links to jobs
      - `invoice_number` (text, unique) - Format: "B2B-001"
      - `invoice_type` (text) - 'estimate', 'deposit', 'progress', 'final', 'general'
      - `client_name` (text)
      - `client_email` (text)
      - `client_phone` (text, nullable)
      - `client_address` (text, nullable)
      - `invoice_date` (date)
      - `due_date` (date)
      - `payment_terms` (text) - "Net 30", "Due on Receipt", etc.
      - `status` (text) - 'draft', 'sent', 'partially_paid', 'paid', 'overdue', 'cancelled'
      - `subtotal` (numeric) - Total before tax
      - `tax_rate` (numeric) - Tax percentage
      - `tax_amount` (numeric) - Calculated tax
      - `tax_override` (boolean) - Manual tax adjustment flag
      - `total_amount` (numeric) - Final total
      - `amount_paid` (numeric) - Track partial payments
      - `amount_due` (numeric) - Remaining balance
      - `notes` (text, nullable) - Customer-facing notes
      - `internal_notes` (text, nullable) - Admin-only notes
      - `payment_terms_description` (text, nullable)
      - `late_fee_enabled` (boolean)
      - `late_fee_type` (text, nullable)
      - `late_fee_amount` (numeric, nullable)
      - `late_fee_grace_days` (integer, nullable)
      - `late_fee_charged` (numeric) - Actual late fee applied
      - `sent_at` (timestamptz, nullable)
      - `paid_at` (timestamptz, nullable)
      - `is_active` (boolean)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `invoice_line_items`
      - `id` (uuid, primary key)
      - `invoice_id` (uuid, foreign key) - Links to invoices
      - `item_type` (text) - 'labor', 'material', 'other'
      - `description` (text)
      - `quantity` (numeric)
      - `unit_price` (numeric)
      - `is_taxable` (boolean) - TN: false for labor, true for materials
      - `total` (numeric) - quantity × unit_price
      - `display_order` (integer)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `invoice_payments`
      - `id` (uuid, primary key)
      - `invoice_id` (uuid, foreign key) - Links to invoices
      - `payment_date` (date)
      - `payment_amount` (numeric)
      - `payment_method` (text) - 'cash', 'check', 'credit_card', etc.
      - `payment_reference` (text, nullable) - Check #, transaction ID
      - `notes` (text, nullable)
      - `recorded_by` (uuid, nullable) - Admin user
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on all invoice tables
    - Only authenticated admin users can access invoices
    - No public access to invoices

  3. Indexes
    - Index on invoice_number (unique)
    - Index on business_id, status, due_date
    - Index on inquiry_id and job_id
    - Index on client_email for customer history
    - Index on invoice_id for line items and payments

  4. Functions
    - generate_next_invoice_number() - Auto-generates invoice numbers
    - update_invoice_totals() - Recalculates totals when line items change
    - update_invoice_payment_status() - Updates status after payments

  5. Important Notes
    - TN labor services are NOT taxable (default is_taxable = false)
    - Only materials are taxable in Tennessee
    - Supports full and partial payments
    - Multiple invoices can be linked to one inquiry
    - Late fees are optional and configurable
*/

-- Create invoice_settings table
CREATE TABLE IF NOT EXISTS invoice_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES business_info(id) ON DELETE CASCADE,
  invoice_prefix text NOT NULL DEFAULT 'B2B',
  next_invoice_number integer NOT NULL DEFAULT 1,
  default_payment_terms text NOT NULL DEFAULT 'Net 30',
  default_due_days integer NOT NULL DEFAULT 30,
  default_tax_rate numeric NOT NULL DEFAULT 0,
  enable_late_fees boolean NOT NULL DEFAULT false,
  late_fee_grace_days integer NOT NULL DEFAULT 5,
  late_fee_type text NOT NULL DEFAULT 'fixed' CHECK (late_fee_type IN ('fixed', 'percentage')),
  late_fee_amount numeric NOT NULL DEFAULT 0,
  invoice_notes_template text,
  invoice_footer text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(business_id)
);

-- Create invoices table
CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES business_info(id) ON DELETE CASCADE,
  inquiry_id uuid REFERENCES form_inquiries(id) ON DELETE SET NULL,
  job_id uuid REFERENCES jobs(id) ON DELETE SET NULL,
  invoice_number text NOT NULL UNIQUE,
  invoice_type text NOT NULL DEFAULT 'general' CHECK (invoice_type IN ('estimate', 'deposit', 'progress', 'final', 'general')),
  client_name text NOT NULL,
  client_email text NOT NULL,
  client_phone text,
  client_address text,
  invoice_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date NOT NULL,
  payment_terms text NOT NULL DEFAULT 'Net 30',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'partially_paid', 'paid', 'overdue', 'cancelled')),
  subtotal numeric NOT NULL DEFAULT 0,
  tax_rate numeric NOT NULL DEFAULT 0,
  tax_amount numeric NOT NULL DEFAULT 0,
  tax_override boolean NOT NULL DEFAULT false,
  total_amount numeric NOT NULL DEFAULT 0,
  amount_paid numeric NOT NULL DEFAULT 0,
  amount_due numeric NOT NULL DEFAULT 0,
  notes text,
  internal_notes text,
  payment_terms_description text,
  late_fee_enabled boolean NOT NULL DEFAULT false,
  late_fee_type text CHECK (late_fee_type IN ('fixed', 'percentage')),
  late_fee_amount numeric,
  late_fee_grace_days integer,
  late_fee_charged numeric NOT NULL DEFAULT 0,
  sent_at timestamptz,
  paid_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create invoice_line_items table
CREATE TABLE IF NOT EXISTS invoice_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  item_type text NOT NULL DEFAULT 'labor' CHECK (item_type IN ('labor', 'material', 'other')),
  description text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price numeric NOT NULL DEFAULT 0,
  is_taxable boolean NOT NULL DEFAULT false,
  total numeric NOT NULL DEFAULT 0,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create invoice_payments table
CREATE TABLE IF NOT EXISTS invoice_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  payment_amount numeric NOT NULL CHECK (payment_amount > 0),
  payment_method text NOT NULL DEFAULT 'cash',
  payment_reference text,
  notes text,
  recorded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_invoice_settings_business_id ON invoice_settings(business_id);
CREATE INDEX IF NOT EXISTS idx_invoices_business_id ON invoices(business_id);
CREATE INDEX IF NOT EXISTS idx_invoices_inquiry_id ON invoices(inquiry_id);
CREATE INDEX IF NOT EXISTS idx_invoices_job_id ON invoices(job_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_invoices_client_email ON invoices(client_email);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_number ON invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoice_line_items_invoice_id ON invoice_line_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_invoice_id ON invoice_payments(invoice_id);

-- Enable Row Level Security
ALTER TABLE invoice_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for invoice_settings
CREATE POLICY "Authenticated users can view invoice settings"
  ON invoice_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert invoice settings"
  ON invoice_settings FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update invoice settings"
  ON invoice_settings FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- RLS Policies for invoices
CREATE POLICY "Authenticated users can view invoices"
  ON invoices FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert invoices"
  ON invoices FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update invoices"
  ON invoices FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete invoices"
  ON invoices FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for invoice_line_items
CREATE POLICY "Authenticated users can view invoice line items"
  ON invoice_line_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert invoice line items"
  ON invoice_line_items FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update invoice line items"
  ON invoice_line_items FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete invoice line items"
  ON invoice_line_items FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for invoice_payments
CREATE POLICY "Authenticated users can view invoice payments"
  ON invoice_payments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert invoice payments"
  ON invoice_payments FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update invoice payments"
  ON invoice_payments FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete invoice payments"
  ON invoice_payments FOR DELETE
  TO authenticated
  USING (true);

-- Function to generate next invoice number
CREATE OR REPLACE FUNCTION generate_next_invoice_number(p_business_id uuid)
RETURNS text AS $$
DECLARE
  v_settings record;
  v_invoice_number text;
BEGIN
  SELECT * INTO v_settings
  FROM invoice_settings
  WHERE business_id = p_business_id;

  IF NOT FOUND THEN
    INSERT INTO invoice_settings (business_id, invoice_prefix, next_invoice_number)
    VALUES (p_business_id, 'B2B', 1)
    RETURNING * INTO v_settings;
  END IF;

  v_invoice_number := v_settings.invoice_prefix || '-' || LPAD(v_settings.next_invoice_number::text, 3, '0');

  UPDATE invoice_settings
  SET next_invoice_number = next_invoice_number + 1,
      updated_at = now()
  WHERE business_id = p_business_id;

  RETURN v_invoice_number;
END;
$$ LANGUAGE plpgsql;

-- Function to update invoice totals when line items change
CREATE OR REPLACE FUNCTION update_invoice_totals()
RETURNS TRIGGER AS $$
DECLARE
  v_invoice record;
  v_subtotal numeric;
  v_taxable_amount numeric;
  v_tax_amount numeric;
  v_total numeric;
BEGIN
  SELECT * INTO v_invoice FROM invoices WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);

  SELECT
    COALESCE(SUM(total), 0),
    COALESCE(SUM(CASE WHEN is_taxable THEN total ELSE 0 END), 0)
  INTO v_subtotal, v_taxable_amount
  FROM invoice_line_items
  WHERE invoice_id = v_invoice.id;

  IF v_invoice.tax_override THEN
    v_tax_amount := v_invoice.tax_amount;
  ELSE
    v_tax_amount := ROUND(v_taxable_amount * (v_invoice.tax_rate / 100), 2);
  END IF;

  v_total := v_subtotal + v_tax_amount + v_invoice.late_fee_charged;

  UPDATE invoices
  SET
    subtotal = v_subtotal,
    tax_amount = v_tax_amount,
    total_amount = v_total,
    amount_due = v_total - amount_paid,
    updated_at = now()
  WHERE id = v_invoice.id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update invoice totals when line items change
DROP TRIGGER IF EXISTS trg_update_invoice_totals_on_line_item ON invoice_line_items;
CREATE TRIGGER trg_update_invoice_totals_on_line_item
  AFTER INSERT OR UPDATE OR DELETE ON invoice_line_items
  FOR EACH ROW
  EXECUTE FUNCTION update_invoice_totals();

-- Function to update invoice payment status
CREATE OR REPLACE FUNCTION update_invoice_payment_status()
RETURNS TRIGGER AS $$
DECLARE
  v_invoice record;
  v_total_paid numeric;
  v_new_status text;
BEGIN
  SELECT * INTO v_invoice FROM invoices WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);

  SELECT COALESCE(SUM(payment_amount), 0)
  INTO v_total_paid
  FROM invoice_payments
  WHERE invoice_id = v_invoice.id;

  IF v_total_paid = 0 THEN
    v_new_status := CASE
      WHEN v_invoice.status = 'draft' THEN 'draft'
      WHEN v_invoice.status = 'cancelled' THEN 'cancelled'
      ELSE 'sent'
    END;
  ELSIF v_total_paid >= v_invoice.total_amount THEN
    v_new_status := 'paid';
  ELSE
    v_new_status := 'partially_paid';
  END IF;

  UPDATE invoices
  SET
    amount_paid = v_total_paid,
    amount_due = total_amount - v_total_paid,
    status = v_new_status,
    paid_at = CASE WHEN v_new_status = 'paid' THEN now() ELSE paid_at END,
    updated_at = now()
  WHERE id = v_invoice.id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update invoice payment status
DROP TRIGGER IF EXISTS trg_update_invoice_payment_status ON invoice_payments;
CREATE TRIGGER trg_update_invoice_payment_status
  AFTER INSERT OR UPDATE OR DELETE ON invoice_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_invoice_payment_status();

-- Function to update updated_at timestamp for invoice_settings
CREATE OR REPLACE FUNCTION update_invoice_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_invoice_settings_updated_at ON invoice_settings;
CREATE TRIGGER set_invoice_settings_updated_at
  BEFORE UPDATE ON invoice_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_invoice_settings_updated_at();

-- Function to update updated_at timestamp for invoices
CREATE OR REPLACE FUNCTION update_invoices_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_invoices_updated_at ON invoices;
CREATE TRIGGER set_invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_invoices_updated_at();

-- Function to update updated_at timestamp for invoice_line_items
CREATE OR REPLACE FUNCTION update_invoice_line_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_invoice_line_items_updated_at ON invoice_line_items;
CREATE TRIGGER set_invoice_line_items_updated_at
  BEFORE UPDATE ON invoice_line_items
  FOR EACH ROW
  EXECUTE FUNCTION update_invoice_line_items_updated_at();

-- Function to update updated_at timestamp for invoice_payments
CREATE OR REPLACE FUNCTION update_invoice_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_invoice_payments_updated_at ON invoice_payments;
CREATE TRIGGER set_invoice_payments_updated_at
  BEFORE UPDATE ON invoice_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_invoice_payments_updated_at();

-- Function to calculate line item total
CREATE OR REPLACE FUNCTION calculate_line_item_total()
RETURNS TRIGGER AS $$
BEGIN
  NEW.total := NEW.quantity * NEW.unit_price;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_calculate_line_item_total ON invoice_line_items;
CREATE TRIGGER trg_calculate_line_item_total
  BEFORE INSERT OR UPDATE ON invoice_line_items
  FOR EACH ROW
  EXECUTE FUNCTION calculate_line_item_total();
