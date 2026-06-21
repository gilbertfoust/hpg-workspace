-- Phase 36: Accounts payable — vendors, bills, bill lines, bill payments

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public' AND t.typname = 'finance_bill_status') THEN
    CREATE TYPE public.finance_bill_status AS ENUM (
      'draft',
      'pending_approval',
      'approved',
      'partially_paid',
      'paid',
      'voided'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.finance_vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text,
  phone text,
  address text,
  tax_notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT finance_vendors_name_not_empty CHECK (char_length(trim(name)) > 0)
);

CREATE SEQUENCE IF NOT EXISTS public.finance_bill_number_seq;

CREATE TABLE IF NOT EXISTS public.finance_bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.finance_vendors(id) ON DELETE RESTRICT,
  bill_number text NOT NULL,
  bill_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date,
  terms text,
  status public.finance_bill_status NOT NULL DEFAULT 'draft',
  memo text,
  document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL,
  total_amount numeric(18, 2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  amount_paid numeric(18, 2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
  journal_entry_id uuid REFERENCES public.finance_journal_entries(id) ON DELETE SET NULL,
  approved_by_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at timestamptz,
  voided_at timestamptz,
  void_reason text,
  created_by_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT finance_bills_bill_number_unique UNIQUE (bill_number),
  CONSTRAINT finance_bills_amount_paid_lte_total CHECK (amount_paid <= total_amount)
);

CREATE TABLE IF NOT EXISTS public.finance_bill_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id uuid NOT NULL REFERENCES public.finance_bills(id) ON DELETE CASCADE,
  expense_account_id uuid NOT NULL REFERENCES public.finance_accounts(id) ON DELETE RESTRICT,
  amount numeric(18, 2) NOT NULL CHECK (amount > 0),
  memo text,
  fund_id uuid REFERENCES public.finance_funds(id) ON DELETE SET NULL,
  ngo_id uuid REFERENCES public.ngos(id) ON DELETE SET NULL,
  department_id uuid REFERENCES public.org_units(id) ON DELETE SET NULL,
  dimension_id uuid REFERENCES public.finance_dimensions(id) ON DELETE SET NULL,
  grant_application_id uuid REFERENCES public.grant_applications(id) ON DELETE SET NULL,
  line_number integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.finance_bill_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id uuid NOT NULL REFERENCES public.finance_bills(id) ON DELETE RESTRICT,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  amount numeric(18, 2) NOT NULL CHECK (amount > 0),
  bank_account_id uuid NOT NULL REFERENCES public.finance_bank_accounts(id) ON DELETE RESTRICT,
  journal_entry_id uuid REFERENCES public.finance_journal_entries(id) ON DELETE SET NULL,
  memo text,
  document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL,
  created_by_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_finance_vendors_active ON public.finance_vendors(is_active);
CREATE INDEX IF NOT EXISTS idx_finance_bills_vendor ON public.finance_bills(vendor_id);
CREATE INDEX IF NOT EXISTS idx_finance_bills_status ON public.finance_bills(status);
CREATE INDEX IF NOT EXISTS idx_finance_bills_due_date ON public.finance_bills(due_date);
CREATE INDEX IF NOT EXISTS idx_finance_bill_lines_bill ON public.finance_bill_lines(bill_id);
CREATE INDEX IF NOT EXISTS idx_finance_bill_payments_bill ON public.finance_bill_payments(bill_id);

DROP TRIGGER IF EXISTS trg_finance_vendors_updated_at ON public.finance_vendors;
CREATE TRIGGER trg_finance_vendors_updated_at
  BEFORE UPDATE ON public.finance_vendors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_finance_bills_updated_at ON public.finance_bills;
CREATE TRIGGER trg_finance_bills_updated_at
  BEFORE UPDATE ON public.finance_bills
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_finance_bill_lines_updated_at ON public.finance_bill_lines;
CREATE TRIGGER trg_finance_bill_lines_updated_at
  BEFORE UPDATE ON public.finance_bill_lines
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.finance_assign_bill_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.bill_number IS NULL OR trim(NEW.bill_number) = '' THEN
    NEW.bill_number := 'BILL-' || to_char(COALESCE(NEW.bill_date, CURRENT_DATE), 'YYYY') || '-' ||
      lpad(nextval('public.finance_bill_number_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_finance_assign_bill_number ON public.finance_bills;
CREATE TRIGGER trg_finance_assign_bill_number
  BEFORE INSERT ON public.finance_bills
  FOR EACH ROW EXECUTE FUNCTION public.finance_assign_bill_number();

CREATE OR REPLACE FUNCTION public.finance_recalc_bill_total()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  target_bill_id uuid;
BEGIN
  target_bill_id := COALESCE(NEW.bill_id, OLD.bill_id);

  UPDATE public.finance_bills
  SET total_amount = COALESCE((
    SELECT SUM(amount) FROM public.finance_bill_lines WHERE bill_id = target_bill_id
  ), 0),
  updated_at = now()
  WHERE id = target_bill_id
    AND status IN ('draft', 'pending_approval');

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_finance_recalc_bill_total ON public.finance_bill_lines;
CREATE TRIGGER trg_finance_recalc_bill_total
  AFTER INSERT OR UPDATE OR DELETE ON public.finance_bill_lines
  FOR EACH ROW EXECUTE FUNCTION public.finance_recalc_bill_total();

CREATE OR REPLACE FUNCTION public.finance_resolve_accounts_payable_account_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id
  FROM public.finance_accounts
  WHERE is_active = true
    AND account_type = 'liability'
    AND (
      code = '2000'
      OR account_subtype = 'payable'
    )
  ORDER BY CASE WHEN code = '2000' THEN 0 ELSE 1 END, code
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.finance_guard_bill_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status NOT IN ('draft', 'pending_approval') THEN
    IF NEW.vendor_id IS DISTINCT FROM OLD.vendor_id
       OR NEW.bill_date IS DISTINCT FROM OLD.bill_date
       OR NEW.due_date IS DISTINCT FROM OLD.due_date
       OR NEW.terms IS DISTINCT FROM OLD.terms
       OR NEW.memo IS DISTINCT FROM OLD.memo
       OR NEW.document_id IS DISTINCT FROM OLD.document_id
       OR NEW.total_amount IS DISTINCT FROM OLD.total_amount THEN
      RAISE EXCEPTION 'Approved or paid bills cannot be edited. Void or reverse the related journal entry instead.';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' AND OLD.status <> 'draft' THEN
    RAISE EXCEPTION 'Only draft bills can be deleted.';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_finance_guard_bill_mutation ON public.finance_bills;
CREATE TRIGGER trg_finance_guard_bill_mutation
  BEFORE UPDATE OR DELETE ON public.finance_bills
  FOR EACH ROW EXECUTE FUNCTION public.finance_guard_bill_mutation();

CREATE OR REPLACE FUNCTION public.finance_guard_bill_line_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  bill_status public.finance_bill_status;
BEGIN
  SELECT status INTO bill_status
  FROM public.finance_bills
  WHERE id = COALESCE(NEW.bill_id, OLD.bill_id);

  IF bill_status NOT IN ('draft', 'pending_approval') THEN
    RAISE EXCEPTION 'Bill lines cannot be modified after approval.';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_finance_guard_bill_line_mutation ON public.finance_bill_lines;
CREATE TRIGGER trg_finance_guard_bill_line_mutation
  BEFORE INSERT OR UPDATE OR DELETE ON public.finance_bill_lines
  FOR EACH ROW EXECUTE FUNCTION public.finance_guard_bill_line_mutation();

-- ---------------------------------------------------------------------------
-- RPC: approve_finance_bill — debit expense lines, credit AP, post JE
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.approve_finance_bill(_bill_id uuid)
RETURNS public.finance_bills
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  bill public.finance_bills;
  ap_account_id uuid;
  entry public.finance_journal_entries;
  line_count integer;
  total numeric(18, 2);
BEGIN
  IF NOT public.is_finance_ledger_manager() THEN
    RAISE EXCEPTION 'Finance manager access required to approve bills';
  END IF;

  SELECT * INTO bill FROM public.finance_bills WHERE id = _bill_id FOR UPDATE;
  IF bill.id IS NULL THEN
    RAISE EXCEPTION 'Bill not found';
  END IF;

  IF bill.status NOT IN ('draft', 'pending_approval') THEN
    RAISE EXCEPTION 'Only draft or pending approval bills can be approved. Current status: %', bill.status;
  END IF;

  SELECT COUNT(*), COALESCE(SUM(amount), 0)
  INTO line_count, total
  FROM public.finance_bill_lines
  WHERE bill_id = _bill_id;

  IF line_count = 0 OR total <= 0 THEN
    RAISE EXCEPTION 'Bill must have at least one line with a positive amount';
  END IF;

  ap_account_id := public.finance_resolve_accounts_payable_account_id();
  IF ap_account_id IS NULL THEN
    RAISE EXCEPTION 'No Accounts Payable GL account found. Add account code 2000 or a liability payable account.';
  END IF;

  INSERT INTO public.finance_journal_entries (
    entry_date,
    memo,
    source_type,
    source_id,
    status,
    created_by_user_id
  ) VALUES (
    bill.bill_date,
    COALESCE(bill.memo, 'Bill ' || bill.bill_number),
    'finance_bill',
    bill.id,
    'draft',
    auth.uid()
  )
  RETURNING * INTO entry;

  INSERT INTO public.finance_journal_lines (
    journal_entry_id,
    account_id,
    debit,
    credit,
    memo,
    fund_id,
    ngo_id,
    department_id,
    dimension_id,
    grant_application_id,
    document_id,
    line_number
  )
  SELECT
    entry.id,
    bl.expense_account_id,
    bl.amount,
    0,
    bl.memo,
    bl.fund_id,
    bl.ngo_id,
    bl.department_id,
    bl.dimension_id,
    bl.grant_application_id,
    bill.document_id,
    bl.line_number
  FROM public.finance_bill_lines bl
  WHERE bl.bill_id = _bill_id
  ORDER BY bl.line_number;

  INSERT INTO public.finance_journal_lines (
    journal_entry_id,
    account_id,
    debit,
    credit,
    memo,
    line_number
  ) VALUES (
    entry.id,
    ap_account_id,
    0,
    total,
    'Accounts Payable — ' || bill.bill_number,
    line_count + 1
  );

  entry := public.post_finance_journal_entry(entry.id);

  UPDATE public.finance_bills
  SET status = 'approved',
      journal_entry_id = entry.id,
      approved_by_user_id = auth.uid(),
      approved_at = now(),
      total_amount = total,
      updated_at = now()
  WHERE id = _bill_id
  RETURNING * INTO bill;

  PERFORM public.finance_log_audit_event(
    'finance_bill',
    bill.id,
    'approved',
    jsonb_build_object(
      'bill_number', bill.bill_number,
      'total_amount', total,
      'journal_entry_id', entry.id,
      'journal_entry_number', entry.entry_number
    )
  );

  RETURN bill;
END;
$$;

-- ---------------------------------------------------------------------------
-- RPC: pay_finance_bill — debit AP, credit bank, post JE
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pay_finance_bill(
  _bill_id uuid,
  _amount numeric,
  _bank_account_id uuid,
  _payment_date date DEFAULT CURRENT_DATE,
  _memo text DEFAULT NULL
)
RETURNS public.finance_bill_payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  bill public.finance_bills;
  ap_account_id uuid;
  bank public.finance_bank_accounts;
  entry public.finance_journal_entries;
  payment public.finance_bill_payments;
  balance_due numeric(18, 2);
  payment_amount numeric(18, 2);
  payment_memo text;
BEGIN
  IF NOT public.is_finance_ledger_manager() THEN
    RAISE EXCEPTION 'Finance manager access required to pay bills';
  END IF;

  payment_amount := round(COALESCE(_amount, 0), 2);
  IF payment_amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be greater than zero';
  END IF;

  SELECT * INTO bill FROM public.finance_bills WHERE id = _bill_id FOR UPDATE;
  IF bill.id IS NULL THEN
    RAISE EXCEPTION 'Bill not found';
  END IF;

  IF bill.status NOT IN ('approved', 'partially_paid') THEN
    RAISE EXCEPTION 'Only approved or partially paid bills can be paid. Current status: %', bill.status;
  END IF;

  balance_due := round(bill.total_amount - bill.amount_paid, 2);
  IF payment_amount > balance_due THEN
    RAISE EXCEPTION 'Payment amount (%) exceeds balance due (%)', payment_amount, balance_due;
  END IF;

  SELECT * INTO bank FROM public.finance_bank_accounts WHERE id = _bank_account_id AND is_active = true;
  IF bank.id IS NULL THEN
    RAISE EXCEPTION 'Active bank account not found';
  END IF;

  ap_account_id := public.finance_resolve_accounts_payable_account_id();
  IF ap_account_id IS NULL THEN
    RAISE EXCEPTION 'No Accounts Payable GL account found';
  END IF;

  payment_memo := COALESCE(NULLIF(trim(_memo), ''), 'Payment for bill ' || bill.bill_number);

  INSERT INTO public.finance_journal_entries (
    entry_date,
    memo,
    source_type,
    source_id,
    status,
    created_by_user_id
  ) VALUES (
    _payment_date,
    payment_memo,
    'finance_bill_payment',
    bill.id,
    'draft',
    auth.uid()
  )
  RETURNING * INTO entry;

  INSERT INTO public.finance_journal_lines (
    journal_entry_id, account_id, debit, credit, memo, line_number
  ) VALUES
    (entry.id, ap_account_id, payment_amount, 0, payment_memo, 1),
    (entry.id, bank.linked_finance_account_id, 0, payment_amount, payment_memo, 2);

  entry := public.post_finance_journal_entry(entry.id);

  INSERT INTO public.finance_bill_payments (
    bill_id,
    payment_date,
    amount,
    bank_account_id,
    journal_entry_id,
    memo,
    created_by_user_id
  ) VALUES (
    bill.id,
    _payment_date,
    payment_amount,
    bank.id,
    entry.id,
    payment_memo,
    auth.uid()
  )
  RETURNING * INTO payment;

  UPDATE public.finance_bills
  SET amount_paid = round(amount_paid + payment_amount, 2),
      status = CASE
        WHEN round(amount_paid + payment_amount, 2) >= total_amount THEN 'paid'::public.finance_bill_status
        ELSE 'partially_paid'::public.finance_bill_status
      END,
      updated_at = now()
  WHERE id = bill.id
  RETURNING * INTO bill;

  PERFORM public.finance_log_audit_event(
    'finance_bill',
    bill.id,
    'paid',
    jsonb_build_object(
      'bill_number', bill.bill_number,
      'payment_id', payment.id,
      'payment_amount', payment_amount,
      'balance_remaining', round(bill.total_amount - bill.amount_paid, 2),
      'journal_entry_id', entry.id
    )
  );

  RETURN payment;
END;
$$;

CREATE OR REPLACE FUNCTION public.void_finance_bill(_bill_id uuid, _reason text DEFAULT NULL)
RETURNS public.finance_bills
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  bill public.finance_bills;
BEGIN
  IF NOT public.is_finance_ledger_manager() THEN
    RAISE EXCEPTION 'Finance manager access required to void bills';
  END IF;

  SELECT * INTO bill FROM public.finance_bills WHERE id = _bill_id FOR UPDATE;
  IF bill.id IS NULL THEN
    RAISE EXCEPTION 'Bill not found';
  END IF;

  IF bill.status NOT IN ('draft', 'pending_approval') THEN
    RAISE EXCEPTION 'Only draft or pending approval bills can be voided without payment reversal';
  END IF;

  UPDATE public.finance_bills
  SET status = 'voided',
      voided_at = now(),
      void_reason = COALESCE(NULLIF(trim(_reason), ''), 'Voided by finance user'),
      updated_at = now()
  WHERE id = _bill_id
  RETURNING * INTO bill;

  PERFORM public.finance_log_audit_event(
    'finance_bill',
    bill.id,
    'voided',
    jsonb_build_object('bill_number', bill.bill_number, 'reason', bill.void_reason)
  );

  RETURN bill;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_finance_bill(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.approve_finance_bill(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.pay_finance_bill(uuid, numeric, uuid, date, text) FROM public;
GRANT EXECUTE ON FUNCTION public.pay_finance_bill(uuid, numeric, uuid, date, text) TO authenticated;

REVOKE ALL ON FUNCTION public.void_finance_bill(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.void_finance_bill(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.finance_resolve_accounts_payable_account_id() FROM public;
GRANT EXECUTE ON FUNCTION public.finance_resolve_accounts_payable_account_id() TO authenticated;

ALTER TABLE public.finance_vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_bill_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_bill_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "finance vendors read" ON public.finance_vendors;
CREATE POLICY "finance vendors read"
  ON public.finance_vendors FOR SELECT TO authenticated
  USING (public.can_read_finance_ledger());

DROP POLICY IF EXISTS "finance vendors manage" ON public.finance_vendors;
CREATE POLICY "finance vendors manage"
  ON public.finance_vendors FOR ALL TO authenticated
  USING (public.is_finance_ledger_manager())
  WITH CHECK (public.is_finance_ledger_manager());

DROP POLICY IF EXISTS "finance bills read" ON public.finance_bills;
CREATE POLICY "finance bills read"
  ON public.finance_bills FOR SELECT TO authenticated
  USING (public.can_read_finance_ledger());

DROP POLICY IF EXISTS "finance bills manage" ON public.finance_bills;
CREATE POLICY "finance bills manage"
  ON public.finance_bills FOR ALL TO authenticated
  USING (public.is_finance_ledger_manager())
  WITH CHECK (public.is_finance_ledger_manager());

DROP POLICY IF EXISTS "finance bill lines read" ON public.finance_bill_lines;
CREATE POLICY "finance bill lines read"
  ON public.finance_bill_lines FOR SELECT TO authenticated
  USING (public.can_read_finance_ledger());

DROP POLICY IF EXISTS "finance bill lines manage" ON public.finance_bill_lines;
CREATE POLICY "finance bill lines manage"
  ON public.finance_bill_lines FOR ALL TO authenticated
  USING (public.is_finance_ledger_manager())
  WITH CHECK (public.is_finance_ledger_manager());

DROP POLICY IF EXISTS "finance bill payments read" ON public.finance_bill_payments;
CREATE POLICY "finance bill payments read"
  ON public.finance_bill_payments FOR SELECT TO authenticated
  USING (public.can_read_finance_ledger());

DROP POLICY IF EXISTS "finance bill payments manage" ON public.finance_bill_payments;
CREATE POLICY "finance bill payments manage"
  ON public.finance_bill_payments FOR ALL TO authenticated
  USING (public.is_finance_ledger_manager())
  WITH CHECK (public.is_finance_ledger_manager());
