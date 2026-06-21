-- Phase 38: Deposits and revenue

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public' AND t.typname = 'finance_deposit_source') THEN
    CREATE TYPE public.finance_deposit_source AS ENUM (
      'donation', 'grant_award', 'program_revenue', 'admin_fee', 'reimbursement_refund', 'other_income'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public' AND t.typname = 'finance_deposit_status') THEN
    CREATE TYPE public.finance_deposit_status AS ENUM ('draft', 'pending_approval', 'posted', 'voided');
  END IF;
END $$;

CREATE SEQUENCE IF NOT EXISTS public.finance_deposit_number_seq;

CREATE TABLE IF NOT EXISTS public.finance_deposits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deposit_number text NOT NULL,
  deposit_date date NOT NULL DEFAULT CURRENT_DATE,
  source_type public.finance_deposit_source NOT NULL,
  bank_account_id uuid NOT NULL REFERENCES public.finance_bank_accounts(id) ON DELETE RESTRICT,
  total_amount numeric(18, 2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  status public.finance_deposit_status NOT NULL DEFAULT 'draft',
  memo text,
  document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL,
  restriction_notes text,
  journal_entry_id uuid REFERENCES public.finance_journal_entries(id) ON DELETE SET NULL,
  created_by_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_by_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  posted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT finance_deposits_number_unique UNIQUE (deposit_number)
);

CREATE TABLE IF NOT EXISTS public.finance_deposit_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deposit_id uuid NOT NULL REFERENCES public.finance_deposits(id) ON DELETE CASCADE,
  revenue_account_id uuid NOT NULL REFERENCES public.finance_accounts(id) ON DELETE RESTRICT,
  amount numeric(18, 2) NOT NULL CHECK (amount > 0),
  fund_id uuid REFERENCES public.finance_funds(id) ON DELETE SET NULL,
  ngo_id uuid REFERENCES public.ngos(id) ON DELETE SET NULL,
  grant_application_id uuid REFERENCES public.grant_applications(id) ON DELETE SET NULL,
  restriction_type text,
  donor_source text,
  memo text,
  line_number integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_finance_deposits_status ON public.finance_deposits(status);
CREATE INDEX IF NOT EXISTS idx_finance_deposit_lines_deposit ON public.finance_deposit_lines(deposit_id);

DROP TRIGGER IF EXISTS trg_finance_deposits_updated_at ON public.finance_deposits;
CREATE TRIGGER trg_finance_deposits_updated_at BEFORE UPDATE ON public.finance_deposits FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.finance_assign_deposit_number()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.deposit_number IS NULL OR trim(NEW.deposit_number) = '' THEN
    NEW.deposit_number := 'DEP-' || to_char(COALESCE(NEW.deposit_date, CURRENT_DATE), 'YYYY') || '-' ||
      lpad(nextval('public.finance_deposit_number_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_finance_assign_deposit_number ON public.finance_deposits;
CREATE TRIGGER trg_finance_assign_deposit_number BEFORE INSERT ON public.finance_deposits FOR EACH ROW EXECUTE FUNCTION public.finance_assign_deposit_number();

CREATE OR REPLACE FUNCTION public.finance_recalc_deposit_total()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE target_id uuid;
BEGIN
  target_id := COALESCE(NEW.deposit_id, OLD.deposit_id);
  UPDATE public.finance_deposits SET total_amount = COALESCE((SELECT SUM(amount) FROM public.finance_deposit_lines WHERE deposit_id = target_id), 0), updated_at = now()
  WHERE id = target_id AND status IN ('draft', 'pending_approval');
  RETURN COALESCE(NEW, OLD);
END; $$;

DROP TRIGGER IF EXISTS trg_finance_recalc_deposit_total ON public.finance_deposit_lines;
CREATE TRIGGER trg_finance_recalc_deposit_total AFTER INSERT OR UPDATE OR DELETE ON public.finance_deposit_lines FOR EACH ROW EXECUTE FUNCTION public.finance_recalc_deposit_total();

CREATE OR REPLACE FUNCTION public.post_finance_deposit(_deposit_id uuid)
RETURNS public.finance_deposits
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  dep public.finance_deposits;
  bank public.finance_bank_accounts;
  entry public.finance_journal_entries;
  total numeric(18, 2);
  line_count integer;
BEGIN
  IF NOT public.is_finance_ledger_manager() THEN RAISE EXCEPTION 'Finance manager access required'; END IF;
  SELECT * INTO dep FROM public.finance_deposits WHERE id = _deposit_id FOR UPDATE;
  IF dep.status NOT IN ('draft', 'pending_approval') THEN RAISE EXCEPTION 'Deposit not postable'; END IF;
  SELECT COUNT(*), COALESCE(SUM(amount), 0) INTO line_count, total FROM public.finance_deposit_lines WHERE deposit_id = _deposit_id;
  IF line_count = 0 OR total <= 0 THEN RAISE EXCEPTION 'Deposit must have lines'; END IF;
  SELECT * INTO bank FROM public.finance_bank_accounts WHERE id = dep.bank_account_id;

  INSERT INTO public.finance_journal_entries (entry_date, memo, source_type, source_id, status, created_by_user_id)
  VALUES (dep.deposit_date, COALESCE(dep.memo, dep.deposit_number), 'finance_deposit', dep.id, 'draft', auth.uid())
  RETURNING * INTO entry;

  INSERT INTO public.finance_journal_lines (journal_entry_id, account_id, debit, credit, memo, document_id, line_number)
  VALUES (entry.id, bank.linked_finance_account_id, total, 0, dep.memo, dep.document_id, 1);

  INSERT INTO public.finance_journal_lines (journal_entry_id, account_id, debit, credit, memo, fund_id, ngo_id, grant_application_id, line_number)
  SELECT entry.id, dl.revenue_account_id, 0, dl.amount, dl.memo, dl.fund_id, dl.ngo_id, dl.grant_application_id, dl.line_number + 1
  FROM public.finance_deposit_lines dl WHERE dl.deposit_id = _deposit_id ORDER BY dl.line_number;

  entry := public.post_finance_journal_entry(entry.id);

  UPDATE public.finance_deposits SET status = 'posted', journal_entry_id = entry.id, total_amount = total,
    approved_by_user_id = auth.uid(), posted_at = now(), updated_at = now()
  WHERE id = _deposit_id RETURNING * INTO dep;

  PERFORM public.finance_log_audit_event('finance_deposit', dep.id, 'posted', jsonb_build_object('deposit_number', dep.deposit_number, 'total', total));
  RETURN dep;
END; $$;

REVOKE ALL ON FUNCTION public.post_finance_deposit(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.post_finance_deposit(uuid) TO authenticated;

ALTER TABLE public.finance_deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_deposit_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "finance deposits read" ON public.finance_deposits;
CREATE POLICY "finance deposits read" ON public.finance_deposits FOR SELECT TO authenticated USING (public.can_read_finance_ledger());
DROP POLICY IF EXISTS "finance deposits manage" ON public.finance_deposits;
CREATE POLICY "finance deposits manage" ON public.finance_deposits FOR ALL TO authenticated USING (public.is_finance_ledger_manager()) WITH CHECK (public.is_finance_ledger_manager());
DROP POLICY IF EXISTS "finance deposit lines read" ON public.finance_deposit_lines;
CREATE POLICY "finance deposit lines read" ON public.finance_deposit_lines FOR SELECT TO authenticated USING (public.can_read_finance_ledger());
DROP POLICY IF EXISTS "finance deposit lines manage" ON public.finance_deposit_lines;
CREATE POLICY "finance deposit lines manage" ON public.finance_deposit_lines FOR ALL TO authenticated USING (public.is_finance_ledger_manager()) WITH CHECK (public.is_finance_ledger_manager());
