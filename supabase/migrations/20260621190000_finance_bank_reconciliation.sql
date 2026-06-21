-- Phase 40: Bank reconciliation

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public' AND t.typname = 'finance_reconciliation_status') THEN
    CREATE TYPE public.finance_reconciliation_status AS ENUM ('in_progress', 'finalized', 'voided');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.finance_bank_reconciliations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_account_id uuid NOT NULL REFERENCES public.finance_bank_accounts(id) ON DELETE RESTRICT,
  statement_start_date date NOT NULL,
  statement_end_date date NOT NULL,
  beginning_balance numeric(18, 2) NOT NULL DEFAULT 0,
  ending_balance numeric(18, 2) NOT NULL DEFAULT 0,
  cleared_balance numeric(18, 2) NOT NULL DEFAULT 0,
  difference numeric(18, 2) NOT NULL DEFAULT 0,
  status public.finance_reconciliation_status NOT NULL DEFAULT 'in_progress',
  exception_notes text,
  finalized_by_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  finalized_at timestamptz,
  created_by_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.finance_bank_reconciliation_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reconciliation_id uuid NOT NULL REFERENCES public.finance_bank_reconciliations(id) ON DELETE CASCADE,
  journal_line_id uuid REFERENCES public.finance_journal_lines(id) ON DELETE SET NULL,
  bill_payment_id uuid REFERENCES public.finance_bill_payments(id) ON DELETE SET NULL,
  payment_id uuid REFERENCES public.finance_payments(id) ON DELETE SET NULL,
  deposit_id uuid REFERENCES public.finance_deposits(id) ON DELETE SET NULL,
  transaction_date date,
  description text,
  amount numeric(18, 2) NOT NULL DEFAULT 0,
  is_cleared boolean NOT NULL DEFAULT false,
  locked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_finance_bank_recon_bank ON public.finance_bank_reconciliations(bank_account_id);
CREATE INDEX IF NOT EXISTS idx_finance_bank_recon_items_recon ON public.finance_bank_reconciliation_items(reconciliation_id);

DROP TRIGGER IF EXISTS trg_finance_bank_reconciliations_updated_at ON public.finance_bank_reconciliations;
CREATE TRIGGER trg_finance_bank_reconciliations_updated_at BEFORE UPDATE ON public.finance_bank_reconciliations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.finalize_finance_bank_reconciliation(_recon_id uuid, _exception_notes text DEFAULT NULL)
RETURNS public.finance_bank_reconciliations
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE recon public.finance_bank_reconciliations;
  cleared numeric(18, 2);
BEGIN
  IF NOT public.is_finance_ledger_manager() THEN RAISE EXCEPTION 'Finance manager access required'; END IF;
  SELECT * INTO recon FROM public.finance_bank_reconciliations WHERE id = _recon_id FOR UPDATE;
  IF recon.status <> 'in_progress' THEN RAISE EXCEPTION 'Reconciliation already finalized'; END IF;

  SELECT COALESCE(SUM(amount), 0) INTO cleared FROM public.finance_bank_reconciliation_items
  WHERE reconciliation_id = _recon_id AND is_cleared = true;

  recon.difference := round(recon.ending_balance - (recon.beginning_balance + cleared), 2);
  recon.cleared_balance := cleared;

  IF recon.difference <> 0 AND ( _exception_notes IS NULL OR trim(_exception_notes) = '' ) THEN
    RAISE EXCEPTION 'Difference must be zero or provide approved exception notes. Difference=%', recon.difference;
  END IF;

  UPDATE public.finance_bank_reconciliation_items SET locked_at = now()
  WHERE reconciliation_id = _recon_id AND is_cleared = true;

  UPDATE public.finance_bank_reconciliations SET
    status = 'finalized', cleared_balance = cleared, difference = recon.difference,
    exception_notes = _exception_notes, finalized_by_user_id = auth.uid(), finalized_at = now(), updated_at = now()
  WHERE id = _recon_id RETURNING * INTO recon;

  PERFORM public.finance_log_audit_event('finance_bank_reconciliation', recon.id, 'finalized',
    jsonb_build_object('difference', recon.difference, 'cleared_balance', cleared));
  RETURN recon;
END; $$;

REVOKE ALL ON FUNCTION public.finalize_finance_bank_reconciliation(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.finalize_finance_bank_reconciliation(uuid, text) TO authenticated;

ALTER TABLE public.finance_bank_reconciliations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_bank_reconciliation_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "finance bank reconciliations read" ON public.finance_bank_reconciliations;
CREATE POLICY "finance bank reconciliations read" ON public.finance_bank_reconciliations FOR SELECT TO authenticated USING (public.can_read_finance_ledger());
DROP POLICY IF EXISTS "finance bank reconciliations manage" ON public.finance_bank_reconciliations;
CREATE POLICY "finance bank reconciliations manage" ON public.finance_bank_reconciliations FOR ALL TO authenticated USING (public.is_finance_ledger_manager()) WITH CHECK (public.is_finance_ledger_manager());
DROP POLICY IF EXISTS "finance bank recon items read" ON public.finance_bank_reconciliation_items;
CREATE POLICY "finance bank recon items read" ON public.finance_bank_reconciliation_items FOR SELECT TO authenticated USING (public.can_read_finance_ledger());
DROP POLICY IF EXISTS "finance bank recon items manage" ON public.finance_bank_reconciliation_items;
CREATE POLICY "finance bank recon items manage" ON public.finance_bank_reconciliation_items FOR ALL TO authenticated USING (public.is_finance_ledger_manager()) WITH CHECK (public.is_finance_ledger_manager());
