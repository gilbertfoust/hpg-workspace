
-- Invoices table
CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ngo_id uuid NOT NULL REFERENCES public.ngos(id) ON DELETE CASCADE,
  fiscal_period_id uuid REFERENCES public.fiscal_periods(id),
  invoice_number text NOT NULL,
  customer_name text NOT NULL,
  customer_email text,
  issue_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  subtotal numeric NOT NULL DEFAULT 0,
  tax_amount numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  notes text,
  ar_account_id uuid REFERENCES public.accounts(id),
  transaction_id uuid REFERENCES public.transactions(id),
  payment_transaction_id uuid REFERENCES public.transactions(id),
  paid_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.validate_invoice_status()
  RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status NOT IN ('draft','sent','paid','overdue','void') THEN
    RAISE EXCEPTION 'Invalid invoice status: %', NEW.status;
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;$$;

CREATE TRIGGER trg_validate_invoice_status BEFORE INSERT OR UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.validate_invoice_status();

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage invoices" ON public.invoices FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Invoice line items
CREATE TABLE public.invoice_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  description text NOT NULL DEFAULT '',
  quantity numeric NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  account_id uuid REFERENCES public.accounts(id),
  tax_rate_id uuid,
  amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.invoice_line_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage invoice line items" ON public.invoice_line_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Bills table
CREATE TABLE public.bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ngo_id uuid NOT NULL REFERENCES public.ngos(id) ON DELETE CASCADE,
  fiscal_period_id uuid REFERENCES public.fiscal_periods(id),
  bill_number text NOT NULL,
  vendor_name text NOT NULL,
  vendor_org_id uuid REFERENCES public.crm_organizations(id),
  bill_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  subtotal numeric NOT NULL DEFAULT 0,
  tax_amount numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  notes text,
  ap_account_id uuid REFERENCES public.accounts(id),
  transaction_id uuid REFERENCES public.transactions(id),
  payment_transaction_id uuid REFERENCES public.transactions(id),
  paid_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.validate_bill_status()
  RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status NOT IN ('pending','approved','paid','overdue','void') THEN
    RAISE EXCEPTION 'Invalid bill status: %', NEW.status;
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;$$;

CREATE TRIGGER trg_validate_bill_status BEFORE INSERT OR UPDATE ON public.bills
  FOR EACH ROW EXECUTE FUNCTION public.validate_bill_status();

ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage bills" ON public.bills FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Bill line items
CREATE TABLE public.bill_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id uuid NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
  description text NOT NULL DEFAULT '',
  quantity numeric NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  account_id uuid REFERENCES public.accounts(id),
  amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bill_line_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage bill line items" ON public.bill_line_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Recurring transactions
CREATE TABLE public.recurring_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ngo_id uuid NOT NULL REFERENCES public.ngos(id) ON DELETE CASCADE,
  template_name text NOT NULL,
  frequency text NOT NULL DEFAULT 'monthly',
  next_run_date date NOT NULL,
  end_date date,
  transaction_template jsonb NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  last_posted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.validate_recurring_frequency()
  RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.frequency NOT IN ('weekly','biweekly','monthly','quarterly','annual') THEN
    RAISE EXCEPTION 'Invalid recurring frequency: %', NEW.frequency;
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;$$;

CREATE TRIGGER trg_validate_recurring_frequency BEFORE INSERT OR UPDATE ON public.recurring_transactions
  FOR EACH ROW EXECUTE FUNCTION public.validate_recurring_frequency();

ALTER TABLE public.recurring_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage recurring transactions" ON public.recurring_transactions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Transaction attachments
CREATE TABLE public.transaction_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  storage_path text NOT NULL,
  mime_type text,
  uploaded_by_user_id uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.transaction_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage transaction attachments" ON public.transaction_attachments FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Tax rates
CREATE TABLE public.tax_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ngo_id uuid NOT NULL REFERENCES public.ngos(id) ON DELETE CASCADE,
  name text NOT NULL,
  rate numeric NOT NULL DEFAULT 0,
  is_default boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tax_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage tax rates" ON public.tax_rates FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Add FK from invoice_line_items.tax_rate_id to tax_rates
ALTER TABLE public.invoice_line_items ADD CONSTRAINT invoice_line_items_tax_rate_id_fkey FOREIGN KEY (tax_rate_id) REFERENCES public.tax_rates(id);
