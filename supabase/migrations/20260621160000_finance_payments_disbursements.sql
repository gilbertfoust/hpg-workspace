-- Phase 37: Payments and disbursements

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public' AND t.typname = 'finance_payment_type') THEN
    CREATE TYPE public.finance_payment_type AS ENUM (
      'vendor_bill',
      'reimbursement',
      'ngo_disbursement',
      'grant_pass_through',
      'internal_transfer'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public' AND t.typname = 'finance_payment_status') THEN
    CREATE TYPE public.finance_payment_status AS ENUM (
      'draft',
      'pending_approval',
      'posted',
      'voided'
    );
  END IF;
END $$;

CREATE SEQUENCE IF NOT EXISTS public.finance_payment_number_seq;

CREATE TABLE IF NOT EXISTS public.finance_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_number text NOT NULL,
  payment_type public.finance_payment_type NOT NULL,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  amount numeric(18, 2) NOT NULL CHECK (amount > 0),
  status public.finance_payment_status NOT NULL DEFAULT 'draft',
  bank_account_id uuid REFERENCES public.finance_bank_accounts(id) ON DELETE RESTRICT,
  target_bank_account_id uuid REFERENCES public.finance_bank_accounts(id) ON DELETE RESTRICT,
  bill_id uuid REFERENCES public.finance_bills(id) ON DELETE SET NULL,
  payee_name text,
  ngo_id uuid REFERENCES public.ngos(id) ON DELETE SET NULL,
  fund_id uuid REFERENCES public.finance_funds(id) ON DELETE SET NULL,
  grant_application_id uuid REFERENCES public.grant_applications(id) ON DELETE SET NULL,
  expense_account_id uuid REFERENCES public.finance_accounts(id) ON DELETE SET NULL,
  memo text,
  document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL,
  approval_notes text,
  approved_by_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at timestamptz,
  journal_entry_id uuid REFERENCES public.finance_journal_entries(id) ON DELETE SET NULL,
  voided_at timestamptz,
  void_reason text,
  created_by_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT finance_payments_payment_number_unique UNIQUE (payment_number)
);

CREATE INDEX IF NOT EXISTS idx_finance_payments_type ON public.finance_payments(payment_type);
CREATE INDEX IF NOT EXISTS idx_finance_payments_status ON public.finance_payments(status);
CREATE INDEX IF NOT EXISTS idx_finance_payments_ngo ON public.finance_payments(ngo_id);
CREATE INDEX IF NOT EXISTS idx_finance_payments_date ON public.finance_payments(payment_date);

DROP TRIGGER IF EXISTS trg_finance_payments_updated_at ON public.finance_payments;
CREATE TRIGGER trg_finance_payments_updated_at
  BEFORE UPDATE ON public.finance_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.finance_assign_payment_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.payment_number IS NULL OR trim(NEW.payment_number) = '' THEN
    NEW.payment_number := 'PAY-' || to_char(COALESCE(NEW.payment_date, CURRENT_DATE), 'YYYY') || '-' ||
      lpad(nextval('public.finance_payment_number_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_finance_assign_payment_number ON public.finance_payments;
CREATE TRIGGER trg_finance_assign_payment_number
  BEFORE INSERT ON public.finance_payments
  FOR EACH ROW EXECUTE FUNCTION public.finance_assign_payment_number();

CREATE OR REPLACE FUNCTION public.finance_guard_posted_payment()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IN ('posted', 'voided') THEN
    IF NEW.status IS DISTINCT FROM OLD.status AND NOT (OLD.status = 'posted' AND NEW.status = 'voided') THEN
      RAISE EXCEPTION 'Posted payments cannot be edited directly.';
    END IF;
    IF NEW.amount IS DISTINCT FROM OLD.amount
       OR NEW.payment_type IS DISTINCT FROM OLD.payment_type
       OR NEW.bank_account_id IS DISTINCT FROM OLD.bank_account_id THEN
      IF OLD.status = 'posted' AND NEW.status = 'voided' THEN
        NULL;
      ELSE
        RAISE EXCEPTION 'Posted payments cannot be edited directly.';
      END IF;
    END IF;
  END IF;
  IF TG_OP = 'DELETE' AND OLD.status <> 'draft' THEN
    RAISE EXCEPTION 'Only draft payments can be deleted.';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_finance_guard_posted_payment ON public.finance_payments;
CREATE TRIGGER trg_finance_guard_posted_payment
  BEFORE UPDATE OR DELETE ON public.finance_payments
  FOR EACH ROW EXECUTE FUNCTION public.finance_guard_posted_payment();

CREATE OR REPLACE FUNCTION public.post_finance_payment(_payment_id uuid)
RETURNS public.finance_payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  payment public.finance_payments;
  entry public.finance_journal_entries;
  bank public.finance_bank_accounts;
  target_bank public.finance_bank_accounts;
  ap_account_id uuid;
  memo text;
BEGIN
  IF NOT public.is_finance_ledger_manager() THEN
    RAISE EXCEPTION 'Finance manager access required';
  END IF;

  SELECT * INTO payment FROM public.finance_payments WHERE id = _payment_id FOR UPDATE;
  IF payment.id IS NULL THEN RAISE EXCEPTION 'Payment not found'; END IF;
  IF payment.status NOT IN ('draft', 'pending_approval') THEN
    RAISE EXCEPTION 'Only draft or pending approval payments can be posted';
  END IF;

  memo := COALESCE(payment.memo, payment.payment_number);

  INSERT INTO public.finance_journal_entries (
    entry_date, memo, source_type, source_id, status, created_by_user_id
  ) VALUES (
    payment.payment_date, memo, 'finance_payment', payment.id, 'draft', auth.uid()
  ) RETURNING * INTO entry;

  IF payment.payment_type = 'vendor_bill' THEN
    IF payment.bill_id IS NULL OR payment.bank_account_id IS NULL THEN
      RAISE EXCEPTION 'Vendor bill payment requires bill and bank account';
    END IF;
    PERFORM public.pay_finance_bill(payment.bill_id, payment.amount, payment.bank_account_id, payment.payment_date, memo);
    SELECT journal_entry_id INTO entry.id FROM public.finance_bill_payments
    WHERE bill_id = payment.bill_id ORDER BY created_at DESC LIMIT 1;

  ELSIF payment.payment_type = 'reimbursement' THEN
    IF payment.bank_account_id IS NULL OR payment.expense_account_id IS NULL THEN
      RAISE EXCEPTION 'Reimbursement requires bank account and expense account';
    END IF;
    SELECT * INTO bank FROM public.finance_bank_accounts WHERE id = payment.bank_account_id;
    INSERT INTO public.finance_journal_lines (journal_entry_id, account_id, debit, credit, memo, fund_id, ngo_id, department_id, document_id, line_number)
    VALUES
      (entry.id, payment.expense_account_id, payment.amount, 0, memo, payment.fund_id, payment.ngo_id, NULL, payment.document_id, 1),
      (entry.id, bank.linked_finance_account_id, 0, payment.amount, memo, 2);
    entry := public.post_finance_journal_entry(entry.id);

  ELSIF payment.payment_type IN ('ngo_disbursement', 'grant_pass_through') THEN
    IF payment.bank_account_id IS NULL OR payment.ngo_id IS NULL THEN
      RAISE EXCEPTION 'Disbursement requires bank account and NGO';
    END IF;
    SELECT * INTO bank FROM public.finance_bank_accounts WHERE id = payment.bank_account_id;
    INSERT INTO public.finance_journal_lines (journal_entry_id, account_id, debit, credit, memo, fund_id, ngo_id, grant_application_id, document_id, line_number)
    SELECT
      entry.id,
      COALESCE(
        (SELECT id FROM public.finance_accounts WHERE is_active AND account_type = 'expense' AND account_subtype = 'grant_disbursement' LIMIT 1),
        (SELECT id FROM public.finance_accounts WHERE is_active AND code = '5100' LIMIT 1),
        (SELECT id FROM public.finance_accounts WHERE is_active AND account_type = 'expense' ORDER BY code LIMIT 1)
      ),
      payment.amount, 0, memo, payment.fund_id, payment.ngo_id, payment.grant_application_id, payment.document_id, 1;
    INSERT INTO public.finance_journal_lines (journal_entry_id, account_id, debit, credit, memo, line_number)
    VALUES (entry.id, bank.linked_finance_account_id, 0, payment.amount, memo, 2);
    entry := public.post_finance_journal_entry(entry.id);

  ELSIF payment.payment_type = 'internal_transfer' THEN
    IF payment.bank_account_id IS NULL OR payment.target_bank_account_id IS NULL THEN
      RAISE EXCEPTION 'Internal transfer requires source and target bank accounts';
    END IF;
    SELECT * INTO bank FROM public.finance_bank_accounts WHERE id = payment.bank_account_id;
    SELECT * INTO target_bank FROM public.finance_bank_accounts WHERE id = payment.target_bank_account_id;
    INSERT INTO public.finance_journal_lines (journal_entry_id, account_id, debit, credit, memo, line_number)
    VALUES
      (entry.id, target_bank.linked_finance_account_id, payment.amount, 0, memo, 1),
      (entry.id, bank.linked_finance_account_id, 0, payment.amount, memo, 2);
    entry := public.post_finance_journal_entry(entry.id);
  END IF;

  UPDATE public.finance_payments
  SET status = 'posted',
      journal_entry_id = entry.id,
      approved_by_user_id = COALESCE(approved_by_user_id, auth.uid()),
      approved_at = COALESCE(approved_at, now()),
      updated_at = now()
  WHERE id = _payment_id
  RETURNING * INTO payment;

  PERFORM public.finance_log_audit_event('finance_payment', payment.id, 'posted',
    jsonb_build_object('payment_number', payment.payment_number, 'amount', payment.amount, 'journal_entry_id', entry.id));

  RETURN payment;
END;
$$;

CREATE OR REPLACE FUNCTION public.void_finance_payment(_payment_id uuid, _reason text DEFAULT NULL)
RETURNS public.finance_payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE payment public.finance_payments;
BEGIN
  IF NOT public.is_finance_ledger_manager() THEN RAISE EXCEPTION 'Finance manager access required'; END IF;
  SELECT * INTO payment FROM public.finance_payments WHERE id = _payment_id FOR UPDATE;
  IF payment.status <> 'posted' THEN RAISE EXCEPTION 'Only posted payments can be voided'; END IF;
  UPDATE public.finance_payments SET status = 'voided', voided_at = now(),
    void_reason = COALESCE(NULLIF(trim(_reason), ''), 'Voided'), updated_at = now()
  WHERE id = _payment_id RETURNING * INTO payment;
  PERFORM public.finance_log_audit_event('finance_payment', payment.id, 'voided', jsonb_build_object('reason', payment.void_reason));
  RETURN payment;
END;
$$;

REVOKE ALL ON FUNCTION public.post_finance_payment(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.post_finance_payment(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.void_finance_payment(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.void_finance_payment(uuid, text) TO authenticated;

ALTER TABLE public.finance_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "finance payments read" ON public.finance_payments;
CREATE POLICY "finance payments read" ON public.finance_payments FOR SELECT TO authenticated USING (public.can_read_finance_ledger());
DROP POLICY IF EXISTS "finance payments manage" ON public.finance_payments;
CREATE POLICY "finance payments manage" ON public.finance_payments FOR ALL TO authenticated USING (public.is_finance_ledger_manager()) WITH CHECK (public.is_finance_ledger_manager());
