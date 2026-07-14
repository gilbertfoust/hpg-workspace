-- Finance close, go-live migration, and year-end authority
--
-- Turns staged opening balances into an auditable posted journal, prevents an
-- incomplete period from being closed, and seals a fiscal year together with
-- an immutable reporting package.

ALTER TABLE public.finance_fiscal_periods
  ADD COLUMN IF NOT EXISTS opening_balance_journal_entry_id uuid
    REFERENCES public.finance_journal_entries(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS close_readiness_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS close_check_completed_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS idx_finance_fiscal_period_opening_journal
  ON public.finance_fiscal_periods(opening_balance_journal_entry_id)
  WHERE opening_balance_journal_entry_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.finance_year_end_closes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ngo_id uuid REFERENCES public.ngos(id) ON DELETE RESTRICT,
  fiscal_year integer NOT NULL CHECK (fiscal_year BETWEEN 1900 AND 2200),
  fiscal_period_id uuid NOT NULL REFERENCES public.finance_fiscal_periods(id) ON DELETE RESTRICT,
  package_id uuid NOT NULL REFERENCES public.finance_year_end_packages(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'finalized' CHECK (status IN ('finalized', 'reopened')),
  readiness_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  finalized_by_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  finalized_at timestamptz,
  reopened_by_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reopened_at timestamptz,
  reopen_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_finance_year_end_closes_scope_year
  ON public.finance_year_end_closes(
    COALESCE(ngo_id, '00000000-0000-0000-0000-000000000000'::uuid),
    fiscal_year
  );
CREATE INDEX IF NOT EXISTS idx_finance_year_end_closes_period
  ON public.finance_year_end_closes(fiscal_period_id);
CREATE INDEX IF NOT EXISTS idx_finance_year_end_closes_package
  ON public.finance_year_end_closes(package_id);
CREATE INDEX IF NOT EXISTS idx_finance_year_end_closes_finalized_by
  ON public.finance_year_end_closes(finalized_by_user_id);
CREATE INDEX IF NOT EXISTS idx_finance_year_end_closes_reopened_by
  ON public.finance_year_end_closes(reopened_by_user_id);

DROP TRIGGER IF EXISTS trg_finance_year_end_closes_updated_at ON public.finance_year_end_closes;
CREATE TRIGGER trg_finance_year_end_closes_updated_at
  BEFORE UPDATE ON public.finance_year_end_closes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.finance_year_end_closes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "finance year end closes read" ON public.finance_year_end_closes;
CREATE POLICY "finance year end closes read"
  ON public.finance_year_end_closes FOR SELECT TO authenticated
  USING (public.can_read_finance_ledger() OR public.is_finance_auditor());

DROP POLICY IF EXISTS "finance year end closes insert" ON public.finance_year_end_closes;
CREATE POLICY "finance year end closes insert"
  ON public.finance_year_end_closes FOR INSERT TO authenticated
  WITH CHECK (public.is_finance_ledger_manager());

DROP POLICY IF EXISTS "finance year end closes update" ON public.finance_year_end_closes;
CREATE POLICY "finance year end closes update"
  ON public.finance_year_end_closes FOR UPDATE TO authenticated
  USING (public.is_finance_ledger_manager())
  WITH CHECK (public.is_finance_ledger_manager());

-- Opening balances are staging rows until they are balanced and posted.  The
-- trigger protects the same contract even when a manager uses the Data API.
CREATE OR REPLACE FUNCTION public.finance_guard_opening_balance()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  period_row public.finance_fiscal_periods;
  target_period_id uuid := COALESCE(NEW.fiscal_period_id, OLD.fiscal_period_id);
BEGIN
  SELECT * INTO period_row
  FROM public.finance_fiscal_periods
  WHERE id = target_period_id;

  IF period_row.id IS NULL THEN
    RAISE EXCEPTION 'Fiscal period not found';
  END IF;
  IF period_row.status <> 'open' THEN
    RAISE EXCEPTION 'Opening balances can only be changed in an open period';
  END IF;
  IF period_row.opening_balance_journal_entry_id IS NOT NULL THEN
    RAISE EXCEPTION 'Opening balances have already been posted for this period';
  END IF;

  IF TG_OP <> 'DELETE' THEN
    IF NEW.ngo_id IS DISTINCT FROM period_row.ngo_id THEN
      RAISE EXCEPTION 'Opening balance NGO must match the fiscal period';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.finance_accounts account
      WHERE account.id = NEW.account_id AND account.is_active
    ) THEN
      RAISE EXCEPTION 'Opening balance account must be active';
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_finance_guard_opening_balance ON public.finance_opening_balances;
CREATE TRIGGER trg_finance_guard_opening_balance
  BEFORE INSERT OR UPDATE OR DELETE ON public.finance_opening_balances
  FOR EACH ROW EXECUTE FUNCTION public.finance_guard_opening_balance();

CREATE OR REPLACE FUNCTION public.upsert_finance_opening_balance(
  _fiscal_period_id uuid,
  _account_id uuid,
  _debit numeric DEFAULT 0,
  _credit numeric DEFAULT 0,
  _fund_id uuid DEFAULT NULL,
  _ngo_id uuid DEFAULT NULL,
  _memo text DEFAULT NULL
)
RETURNS public.finance_opening_balances
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  balance_row public.finance_opening_balances;
  period_row public.finance_fiscal_periods;
  normalized_debit numeric(18, 2) := round(COALESCE(_debit, 0), 2);
  normalized_credit numeric(18, 2) := round(COALESCE(_credit, 0), 2);
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_finance_ledger_manager() THEN
    RAISE EXCEPTION 'Finance manager access required';
  END IF;

  SELECT * INTO period_row FROM public.finance_fiscal_periods
  WHERE id = _fiscal_period_id FOR UPDATE;
  IF period_row.id IS NULL THEN RAISE EXCEPTION 'Fiscal period not found'; END IF;
  IF period_row.period_type <> 'month' THEN
    RAISE EXCEPTION 'Opening balances must be staged in a monthly fiscal period';
  END IF;
  IF period_row.status <> 'open' THEN RAISE EXCEPTION 'Fiscal period must be open'; END IF;
  IF period_row.opening_balance_journal_entry_id IS NOT NULL THEN
    RAISE EXCEPTION 'Opening balances have already been posted for this period';
  END IF;
  IF period_row.ngo_id IS DISTINCT FROM _ngo_id THEN
    RAISE EXCEPTION 'Opening balance NGO must match the fiscal period';
  END IF;
  IF normalized_debit < 0 OR normalized_credit < 0
     OR (normalized_debit > 0) = (normalized_credit > 0) THEN
    RAISE EXCEPTION 'Enter one positive debit or one positive credit';
  END IF;

  INSERT INTO public.finance_opening_balances (
    fiscal_period_id, account_id, fund_id, ngo_id, debit, credit, memo, created_by_user_id
  ) VALUES (
    _fiscal_period_id, _account_id, _fund_id, _ngo_id,
    normalized_debit, normalized_credit, NULLIF(trim(_memo), ''), auth.uid()
  )
  ON CONFLICT (
    fiscal_period_id,
    account_id,
    COALESCE(fund_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(ngo_id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) DO UPDATE SET
    debit = EXCLUDED.debit,
    credit = EXCLUDED.credit,
    memo = EXCLUDED.memo,
    updated_at = now()
  RETURNING * INTO balance_row;

  RETURN balance_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_finance_opening_balance(_opening_balance_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_finance_ledger_manager() THEN
    RAISE EXCEPTION 'Finance manager access required';
  END IF;
  DELETE FROM public.finance_opening_balances WHERE id = _opening_balance_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Opening balance not found'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.import_finance_opening_balances(
  _fiscal_period_id uuid,
  _ngo_id uuid,
  _rows jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  period_row public.finance_fiscal_periods;
  source_row jsonb;
  account_row public.finance_accounts;
  row_number integer := 0;
  debit_value numeric(18, 2);
  credit_value numeric(18, 2);
  total_debit numeric(18, 2) := 0;
  total_credit numeric(18, 2) := 0;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_finance_ledger_manager() THEN
    RAISE EXCEPTION 'Finance manager access required';
  END IF;
  IF jsonb_typeof(_rows) <> 'array' OR jsonb_array_length(_rows) = 0 THEN
    RAISE EXCEPTION 'Opening balance import must contain at least one row';
  END IF;

  SELECT * INTO period_row FROM public.finance_fiscal_periods
  WHERE id = _fiscal_period_id FOR UPDATE;
  IF period_row.id IS NULL THEN RAISE EXCEPTION 'Fiscal period not found'; END IF;
  IF period_row.period_type <> 'month' OR period_row.status <> 'open' THEN
    RAISE EXCEPTION 'Select an open monthly fiscal period';
  END IF;
  IF period_row.ngo_id IS DISTINCT FROM _ngo_id THEN
    RAISE EXCEPTION 'Opening balance NGO must match the fiscal period';
  END IF;
  IF period_row.opening_balance_journal_entry_id IS NOT NULL THEN
    RAISE EXCEPTION 'Opening balances have already been posted for this period';
  END IF;

  DELETE FROM public.finance_opening_balances
  WHERE fiscal_period_id = _fiscal_period_id;

  FOR source_row IN SELECT value FROM jsonb_array_elements(_rows) LOOP
    row_number := row_number + 1;
    SELECT * INTO account_row
    FROM public.finance_accounts
    WHERE code = trim(source_row->>'account_code') AND is_active
    LIMIT 1;
    IF account_row.id IS NULL THEN
      RAISE EXCEPTION 'Row % references an unknown or inactive account code: %',
        row_number, COALESCE(source_row->>'account_code', '(blank)');
    END IF;

    BEGIN
      debit_value := round(COALESCE(NULLIF(trim(source_row->>'debit'), '')::numeric, 0), 2);
      credit_value := round(COALESCE(NULLIF(trim(source_row->>'credit'), '')::numeric, 0), 2);
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'Row % contains an invalid debit or credit amount', row_number;
    END;

    IF debit_value < 0 OR credit_value < 0 OR (debit_value > 0) = (credit_value > 0) THEN
      RAISE EXCEPTION 'Row % must contain one positive debit or one positive credit', row_number;
    END IF;

    PERFORM public.upsert_finance_opening_balance(
      _fiscal_period_id, account_row.id, debit_value, credit_value,
      NULLIF(source_row->>'fund_id', '')::uuid, _ngo_id, source_row->>'memo'
    );
    total_debit := total_debit + debit_value;
    total_credit := total_credit + credit_value;
  END LOOP;

  IF total_debit <= 0 OR round(total_debit, 2) <> round(total_credit, 2) THEN
    RAISE EXCEPTION 'Opening balance import is out of balance. Debits=% Credits=%', total_debit, total_credit;
  END IF;

  PERFORM public.finance_log_audit_event(
    'finance_fiscal_period', period_row.id, 'opening_balances_imported',
    jsonb_build_object(
      'ngo_id', period_row.ngo_id,
      'row_count', row_number,
      'total_debit', total_debit,
      'total_credit', total_credit
    )
  );

  RETURN jsonb_build_object(
    'fiscal_period_id', period_row.id,
    'row_count', row_number,
    'total_debit', total_debit,
    'total_credit', total_credit,
    'is_balanced', true
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.post_finance_opening_balances(_fiscal_period_id uuid)
RETURNS public.finance_journal_entries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  period_row public.finance_fiscal_periods;
  entry_row public.finance_journal_entries;
  line_count integer;
  total_debit numeric(18, 2);
  total_credit numeric(18, 2);
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_finance_ledger_manager() THEN
    RAISE EXCEPTION 'Finance manager access required';
  END IF;

  SELECT * INTO period_row FROM public.finance_fiscal_periods
  WHERE id = _fiscal_period_id FOR UPDATE;
  IF period_row.id IS NULL THEN RAISE EXCEPTION 'Fiscal period not found'; END IF;
  IF period_row.period_type <> 'month' OR period_row.status <> 'open' THEN
    RAISE EXCEPTION 'Opening balances can only be posted to an open monthly period';
  END IF;
  IF period_row.opening_balance_journal_entry_id IS NOT NULL THEN
    RAISE EXCEPTION 'Opening balances have already been posted for this period';
  END IF;

  SELECT count(*)::integer, COALESCE(sum(debit), 0), COALESCE(sum(credit), 0)
  INTO line_count, total_debit, total_credit
  FROM public.finance_opening_balances
  WHERE fiscal_period_id = period_row.id;

  IF line_count < 2 OR total_debit <= 0 OR round(total_debit, 2) <> round(total_credit, 2) THEN
    RAISE EXCEPTION 'Opening balances must contain at least two balanced lines. Debits=% Credits=%', total_debit, total_credit;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.finance_opening_balances balance
    WHERE balance.fiscal_period_id = period_row.id
      AND balance.ngo_id IS DISTINCT FROM period_row.ngo_id
  ) THEN
    RAISE EXCEPTION 'Opening balance entity scope is inconsistent';
  END IF;

  INSERT INTO public.finance_journal_entries (
    entry_date, memo, source_type, source_id, status,
    created_by_user_id, ngo_id, fiscal_period_id
  ) VALUES (
    period_row.start_date,
    'Opening balances — ' || period_row.label,
    'finance_opening_balance', period_row.id, 'draft',
    auth.uid(), period_row.ngo_id, period_row.id
  ) RETURNING * INTO entry_row;

  INSERT INTO public.finance_journal_lines (
    journal_entry_id, account_id, debit, credit, memo,
    fund_id, ngo_id, line_number
  )
  SELECT
    entry_row.id, balance.account_id, balance.debit, balance.credit,
    COALESCE(balance.memo, 'Opening balance'), balance.fund_id,
    period_row.ngo_id,
    row_number() OVER (ORDER BY account.code, balance.created_at, balance.id)::integer
  FROM public.finance_opening_balances balance
  JOIN public.finance_accounts account ON account.id = balance.account_id
  WHERE balance.fiscal_period_id = period_row.id;

  entry_row := public.post_finance_journal_entry(entry_row.id);

  UPDATE public.finance_fiscal_periods
  SET opening_balance_journal_entry_id = entry_row.id, updated_at = now()
  WHERE id = period_row.id;

  PERFORM public.finance_log_audit_event(
    'finance_fiscal_period', period_row.id, 'opening_balances_posted',
    jsonb_build_object(
      'ngo_id', period_row.ngo_id,
      'journal_entry_id', entry_row.id,
      'entry_number', entry_row.entry_number,
      'total_debit', total_debit,
      'total_credit', total_credit
    )
  );
  RETURN entry_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.finance_period_close_readiness(_period_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  period_row public.finance_fiscal_periods;
  trial_balance jsonb;
  pending_journals integer;
  unresolved_receipts integer;
  unsupported_expenses integer;
  unreconciled_accounts integer;
  statement_variances integer;
  dependent_open_periods integer;
  staged_opening_balances integer;
  blockers jsonb;
  ready boolean;
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_read_finance_ledger() THEN
    RAISE EXCEPTION 'Finance ledger access required';
  END IF;

  SELECT * INTO period_row FROM public.finance_fiscal_periods WHERE id = _period_id;
  IF period_row.id IS NULL THEN RAISE EXCEPTION 'Fiscal period not found'; END IF;

  trial_balance := public.finance_validate_trial_balance(
    period_row.start_date, period_row.end_date, period_row.ngo_id
  );

  SELECT count(*)::integer INTO pending_journals
  FROM public.finance_journal_entries entry
  WHERE entry.ngo_id IS NOT DISTINCT FROM period_row.ngo_id
    AND entry.entry_date BETWEEN period_row.start_date AND period_row.end_date
    AND entry.status IN ('draft', 'pending_approval');

  SELECT count(*)::integer INTO unresolved_receipts
  FROM public.finance_receipt_drafts draft
  WHERE draft.ngo_id IS NOT DISTINCT FROM period_row.ngo_id
    AND COALESCE(draft.transaction_date, draft.created_at::date)
        BETWEEN period_row.start_date AND period_row.end_date
    AND draft.status <> 'posted';

  SELECT count(*)::integer INTO unsupported_expenses
  FROM public.finance_journal_entries entry
  WHERE entry.ngo_id IS NOT DISTINCT FROM period_row.ngo_id
    AND entry.entry_date BETWEEN period_row.start_date AND period_row.end_date
    AND entry.status = 'posted'
    AND entry.source_type IN ('finance_expense_transaction', 'finance_bill')
    AND NOT public.finance_journal_entry_has_receipt(entry.id);

  SELECT count(*)::integer INTO unreconciled_accounts
  FROM public.finance_bank_accounts bank
  WHERE bank.ngo_id IS NOT DISTINCT FROM period_row.ngo_id
    AND bank.is_active
    AND bank.opening_balance_date <= period_row.end_date
    AND NOT EXISTS (
      SELECT 1 FROM public.finance_bank_reconciliations reconciliation
      WHERE reconciliation.bank_account_id = bank.id
        AND reconciliation.ngo_id IS NOT DISTINCT FROM period_row.ngo_id
        AND reconciliation.status = 'finalized'
        AND reconciliation.statement_end_date >= period_row.end_date
    );

  SELECT count(*)::integer INTO statement_variances
  FROM public.finance_bank_statement_imports statement_import
  WHERE statement_import.ngo_id IS NOT DISTINCT FROM period_row.ngo_id
    AND statement_import.statement_end_date <= period_row.end_date
    AND (
      abs(statement_import.statement_variance) > 0.005
      OR statement_import.status <> 'reconciled'
    );

  SELECT count(*)::integer INTO dependent_open_periods
  FROM public.finance_fiscal_periods dependency
  WHERE dependency.ngo_id IS NOT DISTINCT FROM period_row.ngo_id
    AND dependency.period_type = 'month'
    AND dependency.status = 'open'
    AND dependency.id <> period_row.id
    AND (
      (period_row.period_type = 'month'
       AND dependency.fiscal_year = period_row.fiscal_year
       AND dependency.period_number < period_row.period_number)
      OR
      (period_row.period_type IN ('quarter', 'year')
       AND dependency.start_date >= period_row.start_date
       AND dependency.end_date <= period_row.end_date)
    );

  SELECT count(*)::integer INTO staged_opening_balances
  FROM public.finance_opening_balances balance
  WHERE balance.fiscal_period_id = period_row.id
    AND period_row.opening_balance_journal_entry_id IS NULL;

  ready := COALESCE((trial_balance->>'is_balanced')::boolean, false)
    AND pending_journals = 0
    AND unresolved_receipts = 0
    AND unsupported_expenses = 0
    AND unreconciled_accounts = 0
    AND statement_variances = 0
    AND dependent_open_periods = 0
    AND staged_opening_balances = 0;

  SELECT COALESCE(jsonb_agg(message), '[]'::jsonb) INTO blockers
  FROM (
    SELECT message FROM (VALUES
      (CASE WHEN NOT COALESCE((trial_balance->>'is_balanced')::boolean, false) THEN 'Trial balance is out of balance' END),
      (CASE WHEN pending_journals > 0 THEN pending_journals || ' journal entries are still draft or awaiting approval' END),
      (CASE WHEN unresolved_receipts > 0 THEN unresolved_receipts || ' receipt drafts still require review or posting' END),
      (CASE WHEN unsupported_expenses > 0 THEN unsupported_expenses || ' posted expense entries are missing receipt evidence' END),
      (CASE WHEN unreconciled_accounts > 0 THEN unreconciled_accounts || ' active bank or card accounts are not reconciled through period end' END),
      (CASE WHEN statement_variances > 0 THEN statement_variances || ' statement imports are unresolved or do not tie' END),
      (CASE WHEN dependent_open_periods > 0 THEN dependent_open_periods || ' prerequisite monthly periods are still open' END),
      (CASE WHEN staged_opening_balances > 0 THEN 'Opening balances are staged but have not been posted to the ledger' END)
    ) AS checks(message)
    WHERE message IS NOT NULL
  ) blocking_checks;

  RETURN jsonb_build_object(
    'period_id', period_row.id,
    'ngo_id', period_row.ngo_id,
    'label', period_row.label,
    'start_date', period_row.start_date,
    'end_date', period_row.end_date,
    'status', period_row.status,
    'is_ready', ready,
    'blockers', blockers,
    'trial_balance', trial_balance,
    'pending_journals', pending_journals,
    'unresolved_receipts', unresolved_receipts,
    'unsupported_expenses', unsupported_expenses,
    'unreconciled_bank_accounts', unreconciled_accounts,
    'unresolved_statement_imports', statement_variances,
    'dependent_open_periods', dependent_open_periods,
    'staged_opening_balances', staged_opening_balances,
    'checked_at', now()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.close_finance_fiscal_period(_period_id uuid)
RETURNS public.finance_fiscal_periods
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  period_row public.finance_fiscal_periods;
  readiness jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_finance_ledger_manager() THEN
    RAISE EXCEPTION 'Finance manager access required to close periods';
  END IF;

  SELECT * INTO period_row FROM public.finance_fiscal_periods
  WHERE id = _period_id FOR UPDATE;
  IF period_row.id IS NULL THEN RAISE EXCEPTION 'Fiscal period not found'; END IF;
  IF period_row.status <> 'open' THEN RAISE EXCEPTION 'Only open periods can be closed'; END IF;

  readiness := public.finance_period_close_readiness(period_row.id);
  IF NOT COALESCE((readiness->>'is_ready')::boolean, false) THEN
    RAISE EXCEPTION 'Period is not ready to close: %', readiness->'blockers';
  END IF;

  UPDATE public.finance_fiscal_periods
  SET status = 'closed',
      closed_at = now(),
      closed_by_user_id = auth.uid(),
      close_readiness_snapshot = readiness,
      close_check_completed_at = now(),
      updated_at = now()
  WHERE id = period_row.id
  RETURNING * INTO period_row;

  PERFORM public.finance_log_audit_event(
    'finance_fiscal_period', period_row.id, 'closed',
    jsonb_build_object('label', period_row.label, 'ngo_id', period_row.ngo_id, 'readiness', readiness)
  );
  RETURN period_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.lock_finance_fiscal_period(_period_id uuid)
RETURNS public.finance_fiscal_periods
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  period_row public.finance_fiscal_periods;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_finance_ledger_manager() THEN
    RAISE EXCEPTION 'Finance manager access required to lock periods';
  END IF;

  SELECT * INTO period_row FROM public.finance_fiscal_periods
  WHERE id = _period_id FOR UPDATE;
  IF period_row.id IS NULL THEN RAISE EXCEPTION 'Fiscal period not found'; END IF;
  IF period_row.status <> 'closed' THEN
    RAISE EXCEPTION 'Only a successfully closed period can be locked';
  END IF;

  UPDATE public.finance_fiscal_periods
  SET status = 'locked', locked_at = now(), locked_by_user_id = auth.uid(), updated_at = now()
  WHERE id = period_row.id
  RETURNING * INTO period_row;

  PERFORM public.finance_log_audit_event(
    'finance_fiscal_period', period_row.id, 'locked',
    jsonb_build_object('label', period_row.label, 'ngo_id', period_row.ngo_id)
  );
  RETURN period_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.reopen_finance_fiscal_period(_period_id uuid, _reason text)
RETURNS public.finance_fiscal_periods
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  period_row public.finance_fiscal_periods;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_finance_ledger_manager() THEN
    RAISE EXCEPTION 'Finance manager access required to reopen periods';
  END IF;
  IF NULLIF(trim(_reason), '') IS NULL THEN RAISE EXCEPTION 'Reopen reason is required'; END IF;

  SELECT * INTO period_row FROM public.finance_fiscal_periods
  WHERE id = _period_id FOR UPDATE;
  IF period_row.id IS NULL THEN RAISE EXCEPTION 'Fiscal period not found'; END IF;
  IF period_row.status = 'open' THEN RAISE EXCEPTION 'Period is already open'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.finance_year_end_closes year_close
    WHERE year_close.ngo_id IS NOT DISTINCT FROM period_row.ngo_id
      AND year_close.fiscal_year = period_row.fiscal_year
      AND year_close.status = 'finalized'
  ) THEN
    RAISE EXCEPTION 'Reopen the finalized fiscal year before reopening an individual period';
  END IF;

  UPDATE public.finance_fiscal_periods
  SET status = 'open',
      reopened_at = now(), reopened_by_user_id = auth.uid(),
      reopen_reason = trim(_reason), updated_at = now()
  WHERE id = period_row.id
  RETURNING * INTO period_row;

  PERFORM public.finance_log_audit_event(
    'finance_fiscal_period', period_row.id, 'reopened',
    jsonb_build_object('label', period_row.label, 'ngo_id', period_row.ngo_id, 'reason', trim(_reason))
  );
  RETURN period_row;
END;
$$;

-- Locked packages are immutable.  If a reopened year is closed again, the
-- default label automatically advances to a new revision instead of rewriting
-- the evidence from the prior close.
CREATE OR REPLACE FUNCTION public.generate_finance_year_end_package(
  _fiscal_year integer,
  _ngo_id uuid,
  _label text DEFAULT NULL
)
RETURNS public.finance_year_end_packages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  package_row public.finance_year_end_packages;
  period_row public.finance_fiscal_periods;
  year_start date := make_date(_fiscal_year, 1, 1);
  year_end date := make_date(_fiscal_year, 12, 31);
  base_label text;
  package_label text;
  revision_number integer;
  package_data jsonb;
  readiness jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_finance_ledger_manager() THEN
    RAISE EXCEPTION 'Finance manager access required';
  END IF;

  PERFORM public.finance_ensure_fiscal_calendar(_ngo_id, _fiscal_year);
  SELECT * INTO period_row
  FROM public.finance_fiscal_periods
  WHERE fiscal_year = _fiscal_year
    AND period_type = 'year'
    AND ngo_id IS NOT DISTINCT FROM _ngo_id
  LIMIT 1;

  year_start := period_row.start_date;
  year_end := period_row.end_date;
  base_label := COALESCE(NULLIF(trim(_label), ''), 'FY' || _fiscal_year::text || ' Audit Package');
  package_label := base_label;

  SELECT * INTO package_row
  FROM public.finance_year_end_packages
  WHERE fiscal_year = _fiscal_year
    AND label = package_label
    AND ngo_id IS NOT DISTINCT FROM _ngo_id;

  IF package_row.status = 'locked' THEN
    SELECT COALESCE(count(*), 0)::integer + 1 INTO revision_number
    FROM public.finance_year_end_packages
    WHERE fiscal_year = _fiscal_year
      AND ngo_id IS NOT DISTINCT FROM _ngo_id
      AND (label = base_label OR label LIKE base_label || ' Revision %');
    package_label := base_label || ' Revision ' || revision_number;
    package_row := NULL;
  END IF;

  readiness := public.finance_period_close_readiness(period_row.id);
  package_data := jsonb_build_object(
    'fiscal_year', _fiscal_year,
    'ngo_id', _ngo_id,
    'period_start', year_start,
    'period_end', year_end,
    'close_readiness', readiness,
    'trial_balance_validation', public.finance_validate_trial_balance(year_start, year_end, _ngo_id),
    'statement_of_financial_position', public.finance_statement_of_financial_position(year_end, _ngo_id),
    'statement_of_activities', public.finance_statement_of_activities(year_start, year_end, _ngo_id),
    'statement_of_cash_flows', public.finance_statement_of_cash_flows(year_start, year_end, _ngo_id),
    'functional_expense_report', public.finance_functional_expense_report(year_start, year_end, _ngo_id),
    'restricted_fund_report', public.finance_restricted_fund_report(year_end, _ngo_id),
    'generated_at', now(),
    'generated_by_user_id', auth.uid()
  );

  IF package_row.id IS NULL THEN
    INSERT INTO public.finance_year_end_packages (
      fiscal_year, ngo_id, label, status, fiscal_period_id, package_json, created_by_user_id
    ) VALUES (
      _fiscal_year, _ngo_id, package_label, 'draft', period_row.id, package_data, auth.uid()
    ) RETURNING * INTO package_row;
  ELSE
    UPDATE public.finance_year_end_packages
    SET package_json = package_data, fiscal_period_id = period_row.id, updated_at = now()
    WHERE id = package_row.id
    RETURNING * INTO package_row;
  END IF;

  PERFORM public.finance_log_audit_event(
    'finance_year_end_package', package_row.id, 'generated',
    jsonb_build_object('fiscal_year', _fiscal_year, 'ngo_id', _ngo_id, 'label', package_label)
  );
  RETURN package_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.finance_year_end_close_readiness(
  _fiscal_year integer,
  _ngo_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  year_period public.finance_fiscal_periods;
  period_readiness jsonb;
  open_months integer;
  ready boolean;
  blockers jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_read_finance_ledger() THEN
    RAISE EXCEPTION 'Finance ledger access required';
  END IF;

  SELECT * INTO year_period
  FROM public.finance_fiscal_periods
  WHERE fiscal_year = _fiscal_year
    AND period_type = 'year'
    AND ngo_id IS NOT DISTINCT FROM _ngo_id
  LIMIT 1;
  IF year_period.id IS NULL THEN RAISE EXCEPTION 'Fiscal year calendar not found'; END IF;

  period_readiness := public.finance_period_close_readiness(year_period.id);
  SELECT count(*)::integer INTO open_months
  FROM public.finance_fiscal_periods
  WHERE fiscal_year = _fiscal_year
    AND period_type = 'month'
    AND ngo_id IS NOT DISTINCT FROM _ngo_id
    AND status = 'open';

  ready := COALESCE((period_readiness->>'is_ready')::boolean, false) AND open_months = 0;
  SELECT COALESCE(jsonb_agg(message), '[]'::jsonb) INTO blockers
  FROM (
    SELECT value #>> '{}' AS message
    FROM jsonb_array_elements(COALESCE(period_readiness->'blockers', '[]'::jsonb)) value
    UNION ALL
    SELECT open_months || ' monthly periods must be closed before year-end finalization'
    WHERE open_months > 0
  ) messages;

  RETURN jsonb_build_object(
    'fiscal_year', _fiscal_year,
    'ngo_id', _ngo_id,
    'year_period_id', year_period.id,
    'is_ready', ready,
    'open_months', open_months,
    'period_readiness', period_readiness,
    'blockers', blockers,
    'checked_at', now()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_finance_year_end(
  _fiscal_year integer,
  _ngo_id uuid
)
RETURNS public.finance_year_end_closes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  readiness jsonb;
  package_row public.finance_year_end_packages;
  year_period public.finance_fiscal_periods;
  close_row public.finance_year_end_closes;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_finance_ledger_manager() THEN
    RAISE EXCEPTION 'Finance manager access required';
  END IF;

  PERFORM public.finance_ensure_fiscal_calendar(_ngo_id, _fiscal_year);
  PERFORM pg_advisory_xact_lock(hashtextextended('finance-year-close:' || COALESCE(_ngo_id::text, 'hpg') || ':' || _fiscal_year, 0));

  SELECT * INTO close_row FROM public.finance_year_end_closes
  WHERE ngo_id IS NOT DISTINCT FROM _ngo_id AND fiscal_year = _fiscal_year
  FOR UPDATE;
  IF close_row.status = 'finalized' THEN
    RAISE EXCEPTION 'Fiscal year is already finalized';
  END IF;

  SELECT * INTO year_period FROM public.finance_fiscal_periods
  WHERE ngo_id IS NOT DISTINCT FROM _ngo_id
    AND fiscal_year = _fiscal_year AND period_type = 'year'
  LIMIT 1 FOR UPDATE;

  readiness := public.finance_year_end_close_readiness(_fiscal_year, _ngo_id);
  IF NOT COALESCE((readiness->>'is_ready')::boolean, false) THEN
    RAISE EXCEPTION 'Fiscal year is not ready to finalize: %', readiness->'blockers';
  END IF;

  package_row := public.generate_finance_year_end_package(_fiscal_year, _ngo_id, NULL);
  UPDATE public.finance_year_end_packages
  SET status = 'locked', locked_at = now(), locked_by_user_id = auth.uid(), updated_at = now()
  WHERE id = package_row.id
  RETURNING * INTO package_row;

  UPDATE public.finance_fiscal_periods
  SET status = 'locked',
      closed_at = COALESCE(closed_at, now()),
      closed_by_user_id = COALESCE(closed_by_user_id, auth.uid()),
      locked_at = now(), locked_by_user_id = auth.uid(),
      close_readiness_snapshot = CASE WHEN id = year_period.id THEN readiness ELSE close_readiness_snapshot END,
      close_check_completed_at = CASE WHEN id = year_period.id THEN now() ELSE close_check_completed_at END,
      updated_at = now()
  WHERE ngo_id IS NOT DISTINCT FROM _ngo_id AND fiscal_year = _fiscal_year;

  INSERT INTO public.finance_year_end_closes (
    ngo_id, fiscal_year, fiscal_period_id, package_id, status,
    readiness_snapshot, finalized_by_user_id, finalized_at,
    reopened_by_user_id, reopened_at, reopen_reason
  ) VALUES (
    _ngo_id, _fiscal_year, year_period.id, package_row.id, 'finalized',
    readiness, auth.uid(), now(), NULL, NULL, NULL
  )
  ON CONFLICT (
    COALESCE(ngo_id, '00000000-0000-0000-0000-000000000000'::uuid), fiscal_year
  ) DO UPDATE SET
    fiscal_period_id = EXCLUDED.fiscal_period_id,
    package_id = EXCLUDED.package_id,
    status = 'finalized',
    readiness_snapshot = EXCLUDED.readiness_snapshot,
    finalized_by_user_id = EXCLUDED.finalized_by_user_id,
    finalized_at = EXCLUDED.finalized_at,
    reopened_by_user_id = NULL,
    reopened_at = NULL,
    reopen_reason = NULL,
    updated_at = now()
  RETURNING * INTO close_row;

  PERFORM public.finance_log_audit_event(
    'finance_year_end_close', close_row.id, 'finalized',
    jsonb_build_object(
      'fiscal_year', _fiscal_year, 'ngo_id', _ngo_id,
      'package_id', package_row.id, 'readiness', readiness
    )
  );
  RETURN close_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.reopen_finance_year_end(
  _fiscal_year integer,
  _ngo_id uuid,
  _reason text
)
RETURNS public.finance_year_end_closes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  close_row public.finance_year_end_closes;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_finance_ledger_manager() THEN
    RAISE EXCEPTION 'Finance manager access required';
  END IF;
  IF NULLIF(trim(_reason), '') IS NULL THEN RAISE EXCEPTION 'Reopen reason is required'; END IF;

  SELECT * INTO close_row FROM public.finance_year_end_closes
  WHERE ngo_id IS NOT DISTINCT FROM _ngo_id AND fiscal_year = _fiscal_year
  FOR UPDATE;
  IF close_row.id IS NULL OR close_row.status <> 'finalized' THEN
    RAISE EXCEPTION 'Finalized fiscal year not found';
  END IF;

  UPDATE public.finance_year_end_closes
  SET status = 'reopened', reopened_by_user_id = auth.uid(),
      reopened_at = now(), reopen_reason = trim(_reason), updated_at = now()
  WHERE id = close_row.id
  RETURNING * INTO close_row;

  UPDATE public.finance_fiscal_periods
  SET status = 'closed', updated_at = now()
  WHERE ngo_id IS NOT DISTINCT FROM _ngo_id
    AND fiscal_year = _fiscal_year
    AND status = 'locked';

  PERFORM public.finance_log_audit_event(
    'finance_year_end_close', close_row.id, 'reopened',
    jsonb_build_object('fiscal_year', _fiscal_year, 'ngo_id', _ngo_id, 'reason', trim(_reason))
  );
  RETURN close_row;
END;
$$;

REVOKE ALL ON FUNCTION public.finance_guard_opening_balance() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.upsert_finance_opening_balance(uuid, uuid, numeric, numeric, uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_finance_opening_balance(uuid, uuid, numeric, numeric, uuid, uuid, text) TO authenticated;
REVOKE ALL ON FUNCTION public.delete_finance_opening_balance(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_finance_opening_balance(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.import_finance_opening_balances(uuid, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.import_finance_opening_balances(uuid, uuid, jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.post_finance_opening_balances(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.post_finance_opening_balances(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.finance_period_close_readiness(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finance_period_close_readiness(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.close_finance_fiscal_period(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.close_finance_fiscal_period(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.lock_finance_fiscal_period(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lock_finance_fiscal_period(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.reopen_finance_fiscal_period(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reopen_finance_fiscal_period(uuid, text) TO authenticated;
REVOKE ALL ON FUNCTION public.generate_finance_year_end_package(integer, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_finance_year_end_package(integer, uuid, text) TO authenticated;
REVOKE ALL ON FUNCTION public.finance_year_end_close_readiness(integer, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finance_year_end_close_readiness(integer, uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.finalize_finance_year_end(integer, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finalize_finance_year_end(integer, uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.reopen_finance_year_end(integer, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reopen_finance_year_end(integer, uuid, text) TO authenticated;
