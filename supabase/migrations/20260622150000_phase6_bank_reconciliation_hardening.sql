-- Phase 6: Bank reconciliation hardening

ALTER TABLE public.finance_bank_reconciliations
  ADD COLUMN IF NOT EXISTS book_balance numeric(18, 2),
  ADD COLUMN IF NOT EXISTS statement_document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS approved_by_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS notes text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'finance_bank_recon_approval_status_check') THEN
    ALTER TABLE public.finance_bank_reconciliations
      ADD CONSTRAINT finance_bank_recon_approval_status_check
      CHECK (approval_status IN ('pending', 'approved', 'exception_approved'));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.finance_bank_account_book_balance(
  _bank_account_id uuid,
  _as_of_date date DEFAULT CURRENT_DATE
)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.finance_bank_account_ledger_balance(_bank_account_id), 0);
$$;

CREATE OR REPLACE FUNCTION public.refresh_finance_bank_reconciliation_balances(_recon_id uuid)
RETURNS public.finance_bank_reconciliations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recon public.finance_bank_reconciliations;
  cleared numeric(18, 2);
BEGIN
  IF NOT public.is_finance_ledger_manager() THEN RAISE EXCEPTION 'Finance manager access required'; END IF;

  SELECT * INTO recon FROM public.finance_bank_reconciliations WHERE id = _recon_id FOR UPDATE;
  IF recon.id IS NULL THEN RAISE EXCEPTION 'Reconciliation not found'; END IF;
  IF recon.status <> 'in_progress' THEN RAISE EXCEPTION 'Only in-progress reconciliations can be refreshed'; END IF;

  recon.book_balance := public.finance_bank_account_book_balance(recon.bank_account_id, recon.statement_end_date);

  SELECT COALESCE(SUM(amount), 0) INTO cleared
  FROM public.finance_bank_reconciliation_items
  WHERE reconciliation_id = _recon_id AND is_cleared = true;

  recon.cleared_balance := cleared;
  recon.difference := round(recon.ending_balance - (recon.beginning_balance + cleared), 2);

  UPDATE public.finance_bank_reconciliations
  SET book_balance = recon.book_balance,
      cleared_balance = recon.cleared_balance,
      difference = recon.difference,
      updated_at = now()
  WHERE id = _recon_id
  RETURNING * INTO recon;

  RETURN recon;
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_finance_bank_reconciliation(_recon_id uuid, _exception_notes text DEFAULT NULL)
RETURNS public.finance_bank_reconciliations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recon public.finance_bank_reconciliations;
BEGIN
  IF NOT public.is_finance_ledger_manager() THEN RAISE EXCEPTION 'Finance manager access required'; END IF;

  recon := public.refresh_finance_bank_reconciliation_balances(_recon_id);

  IF recon.difference <> 0 AND ( _exception_notes IS NULL OR trim(_exception_notes) = '' ) THEN
    RAISE EXCEPTION 'Difference must be zero or provide approved exception notes. Difference=%', recon.difference;
  END IF;

  UPDATE public.finance_bank_reconciliation_items SET locked_at = now()
  WHERE reconciliation_id = _recon_id AND is_cleared = true;

  UPDATE public.finance_bank_reconciliations SET
    status = 'finalized',
    exception_notes = _exception_notes,
    notes = COALESCE(notes, _exception_notes),
    approval_status = CASE WHEN recon.difference = 0 THEN 'approved' ELSE 'exception_approved' END,
    approved_by_user_id = auth.uid(),
    approved_at = now(),
    finalized_by_user_id = auth.uid(),
    finalized_at = now(),
    updated_at = now()
  WHERE id = _recon_id
  RETURNING * INTO recon;

  PERFORM public.finance_log_audit_event('finance_bank_reconciliation', recon.id, 'finalized',
    jsonb_build_object('difference', recon.difference, 'book_balance', recon.book_balance));
  RETURN recon;
END;
$$;

GRANT EXECUTE ON FUNCTION public.finance_bank_account_book_balance(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_finance_bank_reconciliation_balances(uuid) TO authenticated;
