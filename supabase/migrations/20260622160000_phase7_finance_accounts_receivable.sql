-- Phase 7: Finance accounts receivable — donors, invoices, receipts

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public' AND t.typname = 'finance_invoice_status') THEN
    CREATE TYPE public.finance_invoice_status AS ENUM ('draft', 'sent', 'partial', 'paid', 'written_off', 'voided');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.finance_donors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text,
  phone text,
  organization_name text,
  donor_type text NOT NULL DEFAULT 'individual',
  ngo_id uuid REFERENCES public.ngos(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_by_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT finance_donors_type_check CHECK (donor_type IN ('individual', 'foundation', 'corporation', 'government', 'other'))
);

CREATE TABLE IF NOT EXISTS public.finance_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text NOT NULL,
  donor_id uuid REFERENCES public.finance_donors(id) ON DELETE SET NULL,
  customer_name text,
  ngo_id uuid REFERENCES public.ngos(id) ON DELETE SET NULL,
  grant_application_id uuid REFERENCES public.grant_applications(id) ON DELETE SET NULL,
  invoice_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date,
  status public.finance_invoice_status NOT NULL DEFAULT 'draft',
  subtotal numeric(18, 2) NOT NULL DEFAULT 0,
  total numeric(18, 2) NOT NULL DEFAULT 0,
  amount_paid numeric(18, 2) NOT NULL DEFAULT 0,
  amount_written_off numeric(18, 2) NOT NULL DEFAULT 0,
  memo text,
  journal_entry_id uuid REFERENCES public.finance_journal_entries(id) ON DELETE SET NULL,
  document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL,
  created_by_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT finance_invoices_number_unique UNIQUE (invoice_number)
);

CREATE TABLE IF NOT EXISTS public.finance_invoice_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.finance_invoices(id) ON DELETE CASCADE,
  account_id uuid REFERENCES public.finance_accounts(id) ON DELETE SET NULL,
  description text NOT NULL,
  amount numeric(18, 2) NOT NULL CHECK (amount >= 0),
  fund_id uuid REFERENCES public.finance_funds(id) ON DELETE SET NULL,
  ngo_id uuid REFERENCES public.ngos(id) ON DELETE SET NULL,
  line_number integer NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS public.finance_invoice_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.finance_invoices(id) ON DELETE CASCADE,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  amount numeric(18, 2) NOT NULL CHECK (amount > 0),
  payment_method text,
  deposit_id uuid REFERENCES public.finance_deposits(id) ON DELETE SET NULL,
  journal_entry_id uuid REFERENCES public.finance_journal_entries(id) ON DELETE SET NULL,
  memo text,
  created_by_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_finance_invoices_status ON public.finance_invoices(status);
CREATE INDEX IF NOT EXISTS idx_finance_invoices_donor ON public.finance_invoices(donor_id);
CREATE INDEX IF NOT EXISTS idx_finance_invoice_payments_invoice ON public.finance_invoice_payments(invoice_id);

CREATE OR REPLACE FUNCTION public.record_finance_invoice_payment(
  _invoice_id uuid,
  _payment_date date,
  _amount numeric,
  _payment_method text DEFAULT NULL,
  _memo text DEFAULT NULL
)
RETURNS public.finance_invoice_payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv public.finance_invoices;
  payment public.finance_invoice_payments;
  remaining numeric(18, 2);
BEGIN
  IF NOT public.is_finance_ledger_manager() THEN RAISE EXCEPTION 'Finance manager access required'; END IF;

  SELECT * INTO inv FROM public.finance_invoices WHERE id = _invoice_id FOR UPDATE;
  IF inv.id IS NULL THEN RAISE EXCEPTION 'Invoice not found'; END IF;
  IF inv.status IN ('voided', 'written_off', 'paid') THEN
    RAISE EXCEPTION 'Invoice cannot receive payments in status %', inv.status;
  END IF;

  remaining := inv.total - inv.amount_paid - inv.amount_written_off;
  IF _amount <= 0 OR _amount > remaining THEN
    RAISE EXCEPTION 'Payment amount invalid. Remaining balance=%', remaining;
  END IF;

  INSERT INTO public.finance_invoice_payments (invoice_id, payment_date, amount, payment_method, memo, created_by_user_id)
  VALUES (_invoice_id, _payment_date, _amount, _payment_method, _memo, auth.uid())
  RETURNING * INTO payment;

  UPDATE public.finance_invoices
  SET amount_paid = amount_paid + _amount,
      status = CASE
        WHEN amount_paid + _amount + amount_written_off >= total THEN 'paid'::public.finance_invoice_status
        ELSE 'partial'::public.finance_invoice_status
      END,
      updated_at = now()
  WHERE id = _invoice_id;

  PERFORM public.finance_log_audit_event('finance_invoice', _invoice_id, 'payment_recorded',
    jsonb_build_object('payment_id', payment.id, 'amount', _amount));

  RETURN payment;
END;
$$;

CREATE OR REPLACE FUNCTION public.write_off_finance_invoice(
  _invoice_id uuid,
  _amount numeric,
  _reason text
)
RETURNS public.finance_invoices
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv public.finance_invoices;
  remaining numeric(18, 2);
BEGIN
  IF NOT public.is_finance_ledger_manager() THEN RAISE EXCEPTION 'Finance manager access required'; END IF;
  IF _reason IS NULL OR trim(_reason) = '' THEN RAISE EXCEPTION 'Write-off reason is required'; END IF;

  SELECT * INTO inv FROM public.finance_invoices WHERE id = _invoice_id FOR UPDATE;
  IF inv.id IS NULL THEN RAISE EXCEPTION 'Invoice not found'; END IF;

  remaining := inv.total - inv.amount_paid - inv.amount_written_off;
  IF _amount <= 0 OR _amount > remaining THEN RAISE EXCEPTION 'Write-off amount invalid. Remaining=%', remaining; END IF;

  UPDATE public.finance_invoices
  SET amount_written_off = amount_written_off + _amount,
      status = CASE WHEN amount_paid + amount_written_off + _amount >= total THEN 'written_off'::public.finance_invoice_status ELSE status END,
      updated_at = now()
  WHERE id = _invoice_id
  RETURNING * INTO inv;

  PERFORM public.finance_log_audit_event('finance_invoice', inv.id, 'written_off',
    jsonb_build_object('amount', _amount, 'reason', _reason));
  RETURN inv;
END;
$$;

ALTER TABLE public.finance_donors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_invoice_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_invoice_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "finance donors read" ON public.finance_donors;
CREATE POLICY "finance donors read" ON public.finance_donors FOR SELECT TO authenticated USING (public.can_read_finance_ledger());
DROP POLICY IF EXISTS "finance donors manage" ON public.finance_donors;
CREATE POLICY "finance donors manage" ON public.finance_donors FOR ALL TO authenticated USING (public.is_finance_ledger_manager()) WITH CHECK (public.is_finance_ledger_manager());

DROP POLICY IF EXISTS "finance invoices read" ON public.finance_invoices;
CREATE POLICY "finance invoices read" ON public.finance_invoices FOR SELECT TO authenticated USING (public.can_read_finance_ledger());
DROP POLICY IF EXISTS "finance invoices manage" ON public.finance_invoices;
CREATE POLICY "finance invoices manage" ON public.finance_invoices FOR ALL TO authenticated USING (public.is_finance_ledger_manager()) WITH CHECK (public.is_finance_ledger_manager());

DROP POLICY IF EXISTS "finance invoice lines read" ON public.finance_invoice_lines;
CREATE POLICY "finance invoice lines read" ON public.finance_invoice_lines FOR SELECT TO authenticated USING (public.can_read_finance_ledger());
DROP POLICY IF EXISTS "finance invoice lines manage" ON public.finance_invoice_lines;
CREATE POLICY "finance invoice lines manage" ON public.finance_invoice_lines FOR ALL TO authenticated USING (public.is_finance_ledger_manager()) WITH CHECK (public.is_finance_ledger_manager());

DROP POLICY IF EXISTS "finance invoice payments read" ON public.finance_invoice_payments;
CREATE POLICY "finance invoice payments read" ON public.finance_invoice_payments FOR SELECT TO authenticated USING (public.can_read_finance_ledger());
DROP POLICY IF EXISTS "finance invoice payments manage" ON public.finance_invoice_payments;
CREATE POLICY "finance invoice payments manage" ON public.finance_invoice_payments FOR ALL TO authenticated USING (public.is_finance_ledger_manager()) WITH CHECK (public.is_finance_ledger_manager());

GRANT EXECUTE ON FUNCTION public.record_finance_invoice_payment(uuid, date, numeric, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.write_off_finance_invoice(uuid, numeric, text) TO authenticated;
