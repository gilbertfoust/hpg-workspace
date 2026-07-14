-- Phase 15: Parent/child accounting integrity. A balanced source form is not sufficient:
-- every economic subledger must tie to its parent control account, and the
-- financial statements must still tie to the authoritative general ledger.

ALTER TABLE public.finance_expense_requests
  ADD COLUMN IF NOT EXISTS finance_payment_id uuid REFERENCES public.finance_payments(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS journal_entry_id uuid REFERENCES public.finance_journal_entries(id) ON DELETE RESTRICT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_finance_expense_request_payment_unique
  ON public.finance_expense_requests(finance_payment_id)
  WHERE finance_payment_id IS NOT NULL;

CREATE TABLE public.finance_integrity_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ngo_id uuid NOT NULL REFERENCES public.ngos(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  is_balanced boolean NOT NULL,
  checks_json jsonb NOT NULL,
  blocking_failures jsonb NOT NULL DEFAULT '[]'::jsonb,
  captured_by_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  captured_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT finance_integrity_snapshot_dates CHECK (end_date >= start_date)
);

CREATE INDEX idx_finance_integrity_snapshots_ngo_date
  ON public.finance_integrity_snapshots(ngo_id, end_date DESC, captured_at DESC);

ALTER TABLE public.finance_integrity_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "finance integrity snapshots read"
  ON public.finance_integrity_snapshots FOR SELECT TO authenticated
  USING (public.can_read_finance_ledger());
CREATE POLICY "finance integrity snapshots create"
  ON public.finance_integrity_snapshots FOR INSERT TO authenticated
  WITH CHECK (public.is_finance_ledger_manager());
GRANT SELECT ON public.finance_integrity_snapshots TO authenticated;

CREATE OR REPLACE FUNCTION public.settle_finance_expense_request(
  _request_id uuid,
  _payment_id uuid,
  _payment_reference text DEFAULT NULL
)
RETURNS public.finance_expense_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  expense public.finance_expense_requests;
  payment public.finance_payments;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_finance_ledger_manager() THEN
    RAISE EXCEPTION 'Finance manager access required';
  END IF;
  SELECT * INTO expense FROM public.finance_expense_requests WHERE id = _request_id FOR UPDATE;
  IF expense.id IS NULL THEN RAISE EXCEPTION 'Expense request not found'; END IF;
  IF expense.status <> 'approved' THEN RAISE EXCEPTION 'Only approved expense requests can be settled'; END IF;
  SELECT * INTO payment FROM public.finance_payments WHERE id = _payment_id FOR UPDATE;
  IF payment.id IS NULL OR payment.status <> 'posted' OR payment.journal_entry_id IS NULL THEN
    RAISE EXCEPTION 'Select a posted ledger payment';
  END IF;
  IF payment.ngo_id IS DISTINCT FROM expense.ngo_id THEN
    RAISE EXCEPTION 'Expense request and payment must belong to the same NGO';
  END IF;
  IF abs(round(payment.amount - expense.amount, 2)) > 0.005 THEN
    RAISE EXCEPTION 'Payment amount % does not match approved request amount %', payment.amount, expense.amount;
  END IF;
  IF expense.budget_account_id IS NOT NULL
     AND payment.expense_account_id IS DISTINCT FROM expense.budget_account_id THEN
    RAISE EXCEPTION 'Payment account does not match the approved budget account';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.finance_expense_requests other
    WHERE other.finance_payment_id = payment.id AND other.id <> expense.id
  ) THEN RAISE EXCEPTION 'Payment is already linked to another expense request'; END IF;

  UPDATE public.finance_expense_requests
  SET status = 'paid', paid_by_user_id = auth.uid(), paid_at = now(),
      payment_reference = COALESCE(NULLIF(trim(_payment_reference), ''), payment.reference_number, payment.payment_number),
      finance_payment_id = payment.id, journal_entry_id = payment.journal_entry_id,
      updated_at = now()
  WHERE id = expense.id RETURNING * INTO expense;

  PERFORM public.finance_set_approval_work_item_status(expense.work_item_id, 'complete');
  PERFORM public.finance_log_audit_event(
    'expense_request', expense.id, 'settled_to_ledger',
    jsonb_build_object('payment_id', payment.id, 'journal_entry_id', payment.journal_entry_id,
      'payment_reference', expense.payment_reference, 'ngo_id', expense.ngo_id)
  );
  PERFORM public.finance_queue_workflow_notifications(
    'expense_request', expense.id, expense.work_item_id, 'paid',
    jsonb_build_object('request_number', expense.request_number,
      'payment_reference', expense.payment_reference, 'journal_entry_id', payment.journal_entry_id)
  );
  RETURN expense;
END;
$$;

-- Retain the old signature only as an explicit guard against disconnected
-- "mark paid" updates. Callers must select the actual posted payment.
CREATE OR REPLACE FUNCTION public.mark_finance_expense_request_paid(
  _request_id uuid,
  _payment_reference text
)
RETURNS public.finance_expense_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_finance_ledger_manager() THEN
    RAISE EXCEPTION 'Finance manager access required';
  END IF;
  RAISE EXCEPTION 'Select the posted payment so this expense request can be tied to the general ledger';
END;
$$;

REVOKE ALL ON FUNCTION public.settle_finance_expense_request(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.settle_finance_expense_request(uuid, uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.finance_accounting_integrity(
  _ngo_id uuid,
  _start_date date,
  _end_date date
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  trial_balance jsonb;
  financial_position jsonb;
  cash_flow jsonb;
  ar_account_id uuid;
  ap_account_id uuid;
  ar_subledger numeric(18,2);
  ar_control numeric(18,2);
  ap_subledger numeric(18,2);
  ap_control numeric(18,2);
  unlinked_sources integer;
  inactive_budget_accounts integer;
  checks jsonb;
  blocking_failures jsonb;
  balanced boolean;
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_read_finance_ledger() THEN
    RAISE EXCEPTION 'Finance ledger access required';
  END IF;
  IF _ngo_id IS NULL THEN RAISE EXCEPTION 'Select an NGO for ecosystem integrity'; END IF;
  IF _end_date < _start_date THEN RAISE EXCEPTION 'Integrity date range is invalid'; END IF;

  trial_balance := public.finance_validate_trial_balance(_start_date, _end_date, _ngo_id);
  financial_position := public.finance_statement_of_financial_position(_end_date, _ngo_id);
  cash_flow := public.finance_statement_of_cash_flows(_start_date, _end_date, _ngo_id);
  ar_account_id := public.finance_resolve_accounts_receivable_account_id();
  ap_account_id := public.finance_resolve_accounts_payable_account_id();

  -- The managed AR subledger includes invoices issued by this ecosystem less
  -- payments and write-offs through the requested date.
  SELECT round(
    COALESCE((
      SELECT sum(invoice.total)
      FROM public.finance_invoices invoice
      WHERE invoice.ngo_id = _ngo_id
        AND invoice.journal_entry_id IS NOT NULL
        AND invoice.invoice_date <= _end_date
        AND invoice.status <> 'voided'
    ), 0)
    - COALESCE((
      SELECT sum(payment.amount)
      FROM public.finance_invoice_payments payment
      WHERE payment.ngo_id = _ngo_id AND payment.payment_date <= _end_date
        AND payment.journal_entry_id IS NOT NULL
    ), 0)
    - COALESCE((
      SELECT sum(adjustment.amount)
      FROM public.finance_invoice_adjustments adjustment
      WHERE adjustment.ngo_id = _ngo_id AND adjustment.adjustment_date <= _end_date
    ), 0), 2
  ) INTO ar_subledger;

  SELECT round(COALESCE(sum(line.debit - line.credit), 0), 2) INTO ar_control
  FROM public.finance_journal_lines line
  JOIN public.finance_journal_entries entry ON entry.id = line.journal_entry_id
  WHERE entry.status = 'posted' AND entry.ngo_id = _ngo_id
    AND entry.entry_date <= _end_date AND line.account_id = ar_account_id
    AND entry.source_type IN ('finance_invoice', 'finance_invoice_payment', 'finance_invoice_write_off');

  SELECT round(
    COALESCE((
      SELECT sum(bill.total_amount)
      FROM public.finance_bills bill
      WHERE bill.ngo_id = _ngo_id AND bill.journal_entry_id IS NOT NULL
        AND bill.bill_date <= _end_date AND bill.status <> 'voided'
    ), 0)
    - COALESCE((
      SELECT sum(payment.amount)
      FROM public.finance_bill_payments payment
      JOIN public.finance_bills bill ON bill.id = payment.bill_id
      WHERE bill.ngo_id = _ngo_id AND payment.payment_date <= _end_date
        AND payment.journal_entry_id IS NOT NULL
    ), 0), 2
  ) INTO ap_subledger;

  SELECT round(COALESCE(sum(line.credit - line.debit), 0), 2) INTO ap_control
  FROM public.finance_journal_lines line
  JOIN public.finance_journal_entries entry ON entry.id = line.journal_entry_id
  WHERE entry.status = 'posted' AND entry.ngo_id = _ngo_id
    AND entry.entry_date <= _end_date AND line.account_id = ap_account_id
    AND entry.source_type IN ('finance_bill', 'finance_bill_payment');

  SELECT count(*)::integer INTO unlinked_sources FROM (
    SELECT bill.id FROM public.finance_bills bill
      WHERE bill.ngo_id = _ngo_id AND bill.bill_date <= _end_date
        AND bill.status IN ('approved','partially_paid','paid') AND bill.journal_entry_id IS NULL
    UNION ALL
    SELECT deposit.id FROM public.finance_deposits deposit
      WHERE deposit.ngo_id = _ngo_id AND deposit.deposit_date <= _end_date
        AND deposit.status = 'posted' AND deposit.journal_entry_id IS NULL
    UNION ALL
    SELECT payment.id FROM public.finance_payments payment
      WHERE payment.ngo_id = _ngo_id AND payment.payment_date <= _end_date
        AND payment.status = 'posted' AND payment.journal_entry_id IS NULL
    UNION ALL
    SELECT invoice.id FROM public.finance_invoices invoice
      WHERE invoice.ngo_id = _ngo_id AND invoice.invoice_date <= _end_date
        AND invoice.status IN ('sent','partial','paid','written_off') AND invoice.journal_entry_id IS NULL
    UNION ALL
    SELECT receipt.id FROM public.finance_invoice_payments receipt
      WHERE receipt.ngo_id = _ngo_id AND receipt.payment_date <= _end_date
        AND receipt.journal_entry_id IS NULL
    UNION ALL
    SELECT request.id FROM public.finance_expense_requests request
      WHERE request.ngo_id = _ngo_id AND request.expense_date <= _end_date
        AND request.status = 'paid'
        AND (request.finance_payment_id IS NULL OR request.journal_entry_id IS NULL)
  ) disconnected;

  SELECT count(*)::integer INTO inactive_budget_accounts
  FROM public.finance_budget_lines line
  JOIN public.finance_budgets budget ON budget.id = line.budget_id
  LEFT JOIN public.finance_ngo_accounts activation
    ON activation.ngo_id = budget.ngo_id AND activation.account_id = line.account_id
  WHERE budget.ngo_id = _ngo_id AND budget.fiscal_year BETWEEN extract(year FROM _start_date)::integer AND extract(year FROM _end_date)::integer
    AND (activation.id IS NULL OR NOT activation.is_active);

  checks := jsonb_build_array(
    jsonb_build_object(
      'key', 'general_ledger', 'label', 'General ledger debits equal credits',
      'parent', 'trial_balance', 'child', 'posted_journal_lines',
      'parent_amount', trial_balance->'total_debit', 'child_amount', trial_balance->'total_credit',
      'difference', round(COALESCE((trial_balance->>'total_debit')::numeric,0) - COALESCE((trial_balance->>'total_credit')::numeric,0),2),
      'is_balanced', COALESCE((trial_balance->>'is_balanced')::boolean,false), 'blocking', true
    ),
    jsonb_build_object(
      'key', 'accounts_receivable', 'label', 'AR subledger ties to its control account',
      'parent', 'accounts_receivable_control', 'child', 'issued_invoices_less_receipts_and_writeoffs',
      'parent_amount', ar_control, 'child_amount', ar_subledger,
      'difference', round(ar_control - ar_subledger,2),
      'is_balanced', abs(round(ar_control - ar_subledger,2)) <= 0.005, 'blocking', true
    ),
    jsonb_build_object(
      'key', 'accounts_payable', 'label', 'AP subledger ties to its control account',
      'parent', 'accounts_payable_control', 'child', 'approved_bills_less_payments',
      'parent_amount', ap_control, 'child_amount', ap_subledger,
      'difference', round(ap_control - ap_subledger,2),
      'is_balanced', abs(round(ap_control - ap_subledger,2)) <= 0.005, 'blocking', true
    ),
    jsonb_build_object(
      'key', 'economic_sources', 'label', 'Every completed economic form is linked to posted journal activity',
      'parent', 'general_ledger', 'child', 'completed_source_forms',
      'difference', unlinked_sources, 'is_balanced', unlinked_sources = 0, 'blocking', true
    ),
    jsonb_build_object(
      'key', 'budget_accounts', 'label', 'Every operating-budget account is active in the NGO ledger',
      'parent', 'ngo_chart_of_accounts', 'child', 'budget_lines',
      'difference', inactive_budget_accounts, 'is_balanced', inactive_budget_accounts = 0, 'blocking', true
    ),
    jsonb_build_object(
      'key', 'financial_position', 'label', 'Assets equal liabilities plus net assets',
      'parent', 'statement_of_financial_position', 'child', 'general_ledger_balances',
      'difference', COALESCE((financial_position->>'statement_difference')::numeric,0),
      'is_balanced', COALESCE((financial_position->>'statement_is_balanced')::boolean,false), 'blocking', true
    ),
    jsonb_build_object(
      'key', 'cash_flow', 'label', 'Beginning cash plus net change equals ending cash',
      'parent', 'statement_of_cash_flows', 'child', 'cash_account_activity',
      'difference', round(
        COALESCE((cash_flow->>'beginning_cash_balance')::numeric,0)
        + COALESCE((cash_flow->>'net_change_in_cash')::numeric,0)
        - COALESCE((cash_flow->>'ending_cash_balance')::numeric,0), 2),
      'is_balanced', COALESCE((cash_flow->>'cash_flow_ties')::boolean,false), 'blocking', true
    )
  );

  SELECT COALESCE(jsonb_agg(item->>'label'), '[]'::jsonb),
         bool_and(COALESCE((item->>'is_balanced')::boolean, false))
  INTO blocking_failures, balanced
  FROM jsonb_array_elements(checks) item
  WHERE COALESCE((item->>'blocking')::boolean, false)
    AND NOT COALESCE((item->>'is_balanced')::boolean, false);

  balanced := COALESCE(balanced, true) AND jsonb_array_length(blocking_failures) = 0;
  RETURN jsonb_build_object(
    'ngo_id', _ngo_id, 'start_date', _start_date, 'end_date', _end_date,
    'is_balanced', balanced, 'checks', checks,
    'blocking_failures', blocking_failures, 'checked_at', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.finance_accounting_integrity(uuid, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finance_accounting_integrity(uuid, date, date) TO authenticated;

CREATE OR REPLACE FUNCTION public.capture_finance_accounting_integrity(
  _ngo_id uuid,
  _start_date date,
  _end_date date
)
RETURNS public.finance_integrity_snapshots
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE result jsonb; snapshot public.finance_integrity_snapshots;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_finance_ledger_manager() THEN RAISE EXCEPTION 'Finance manager access required'; END IF;
  result := public.finance_accounting_integrity(_ngo_id, _start_date, _end_date);
  INSERT INTO public.finance_integrity_snapshots (
    ngo_id, start_date, end_date, is_balanced, checks_json,
    blocking_failures, captured_by_user_id
  ) VALUES (
    _ngo_id, _start_date, _end_date,
    COALESCE((result->>'is_balanced')::boolean,false),
    result->'checks', result->'blocking_failures', auth.uid()
  ) RETURNING * INTO snapshot;
  PERFORM public.finance_log_audit_event(
    'finance_integrity_snapshot', snapshot.id, 'captured',
    jsonb_build_object('ngo_id', _ngo_id, 'start_date', _start_date,
      'end_date', _end_date, 'is_balanced', snapshot.is_balanced)
  );
  RETURN snapshot;
END;
$$;

REVOKE ALL ON FUNCTION public.capture_finance_accounting_integrity(uuid, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.capture_finance_accounting_integrity(uuid, date, date) TO authenticated;

-- Preserve the existing readiness calculation and wrap it with the ecosystem
-- control graph. A period cannot close just because its journal itself balances.
ALTER FUNCTION public.finance_period_close_readiness(uuid)
  RENAME TO finance_period_close_readiness_without_ecosystem;

REVOKE ALL ON FUNCTION public.finance_period_close_readiness_without_ecosystem(uuid)
  FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.finance_period_close_readiness(_period_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base jsonb;
  period_row public.finance_fiscal_periods;
  ecosystem jsonb;
  combined_blockers jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_read_finance_ledger() THEN
    RAISE EXCEPTION 'Finance ledger access required';
  END IF;
  SELECT * INTO period_row FROM public.finance_fiscal_periods WHERE id = _period_id;
  IF period_row.id IS NULL THEN RAISE EXCEPTION 'Fiscal period not found'; END IF;
  base := public.finance_period_close_readiness_without_ecosystem(_period_id);

  IF period_row.ngo_id IS NULL THEN
    RETURN base || jsonb_build_object(
      'ecosystem_integrity', NULL,
      'blockers', COALESCE(base->'blockers','[]'::jsonb) || jsonb_build_array('Select an NGO before closing an accounting period'),
      'is_ready', false
    );
  END IF;

  ecosystem := public.finance_accounting_integrity(
    period_row.ngo_id, period_row.start_date, period_row.end_date
  );
  combined_blockers := COALESCE(base->'blockers','[]'::jsonb)
    || COALESCE(ecosystem->'blocking_failures','[]'::jsonb);

  RETURN base || jsonb_build_object(
    'ecosystem_integrity', ecosystem,
    'blockers', combined_blockers,
    'is_ready', COALESCE((base->>'is_ready')::boolean,false)
      AND COALESCE((ecosystem->>'is_balanced')::boolean,false)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.finance_period_close_readiness(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finance_period_close_readiness(uuid) TO authenticated;
