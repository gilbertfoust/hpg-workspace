-- Phase 3: Organization-wide fiscal periods, opening balances, and period locking for finance_* ledger

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public' AND t.typname = 'finance_period_status') THEN
    CREATE TYPE public.finance_period_status AS ENUM ('open', 'closed', 'locked');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.finance_fiscal_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  fiscal_year integer NOT NULL,
  period_number integer,
  period_type text NOT NULL DEFAULT 'month',
  start_date date NOT NULL,
  end_date date NOT NULL,
  status public.finance_period_status NOT NULL DEFAULT 'open',
  closed_at timestamptz,
  closed_by_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  locked_at timestamptz,
  locked_by_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reopened_at timestamptz,
  reopened_by_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reopen_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT finance_fiscal_periods_type_check CHECK (period_type IN ('year', 'quarter', 'month')),
  CONSTRAINT finance_fiscal_periods_dates_check CHECK (end_date >= start_date)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_finance_fiscal_periods_label_year
  ON public.finance_fiscal_periods(fiscal_year, label);

CREATE INDEX IF NOT EXISTS idx_finance_fiscal_periods_dates ON public.finance_fiscal_periods(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_finance_fiscal_periods_status ON public.finance_fiscal_periods(status);

CREATE TABLE IF NOT EXISTS public.finance_opening_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fiscal_period_id uuid NOT NULL REFERENCES public.finance_fiscal_periods(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.finance_accounts(id) ON DELETE RESTRICT,
  fund_id uuid REFERENCES public.finance_funds(id) ON DELETE SET NULL,
  ngo_id uuid REFERENCES public.ngos(id) ON DELETE SET NULL,
  debit numeric(18, 2) NOT NULL DEFAULT 0 CHECK (debit >= 0),
  credit numeric(18, 2) NOT NULL DEFAULT 0 CHECK (credit >= 0),
  memo text,
  created_by_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT finance_opening_balances_nonzero CHECK (debit > 0 OR credit > 0),
  CONSTRAINT finance_opening_balances_exclusive CHECK (NOT (debit > 0 AND credit > 0))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_finance_opening_balances_unique
  ON public.finance_opening_balances(
    fiscal_period_id,
    account_id,
    COALESCE(fund_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(ngo_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

ALTER TABLE public.finance_journal_entries
  ADD COLUMN IF NOT EXISTS fiscal_period_id uuid REFERENCES public.finance_fiscal_periods(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_finance_journal_entries_fiscal_period ON public.finance_journal_entries(fiscal_period_id);

DROP TRIGGER IF EXISTS trg_finance_fiscal_periods_updated_at ON public.finance_fiscal_periods;
CREATE TRIGGER trg_finance_fiscal_periods_updated_at
  BEFORE UPDATE ON public.finance_fiscal_periods
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_finance_opening_balances_updated_at ON public.finance_opening_balances;
CREATE TRIGGER trg_finance_opening_balances_updated_at
  BEFORE UPDATE ON public.finance_opening_balances
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.get_finance_open_fiscal_period(
  _entry_date date,
  _fiscal_period_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  resolved_id uuid;
BEGIN
  IF _fiscal_period_id IS NOT NULL THEN
    SELECT fp.id INTO resolved_id
    FROM public.finance_fiscal_periods fp
    WHERE fp.id = _fiscal_period_id
      AND _entry_date >= fp.start_date
      AND _entry_date <= fp.end_date
      AND fp.status = 'open';

    IF resolved_id IS NULL THEN
      RAISE EXCEPTION 'Fiscal period is missing, closed, locked, or does not cover entry date %', _entry_date;
    END IF;
    RETURN resolved_id;
  END IF;

  SELECT fp.id INTO resolved_id
  FROM public.finance_fiscal_periods fp
  WHERE _entry_date >= fp.start_date
    AND _entry_date <= fp.end_date
    AND fp.status = 'open'
  ORDER BY fp.start_date DESC
  LIMIT 1;

  IF resolved_id IS NULL THEN
    RAISE EXCEPTION 'No open finance fiscal period found for date %', _entry_date;
  END IF;

  RETURN resolved_id;
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
BEGIN
  IF NOT public.is_finance_ledger_manager() THEN
    RAISE EXCEPTION 'Finance manager access required to close periods';
  END IF;

  SELECT * INTO period_row FROM public.finance_fiscal_periods WHERE id = _period_id FOR UPDATE;
  IF period_row.id IS NULL THEN RAISE EXCEPTION 'Fiscal period not found'; END IF;
  IF period_row.status <> 'open' THEN RAISE EXCEPTION 'Only open periods can be closed'; END IF;

  UPDATE public.finance_fiscal_periods
  SET status = 'closed', closed_at = now(), closed_by_user_id = auth.uid(), updated_at = now()
  WHERE id = _period_id
  RETURNING * INTO period_row;

  PERFORM public.finance_log_audit_event('finance_fiscal_period', period_row.id, 'closed', jsonb_build_object('label', period_row.label));
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
  IF NOT public.is_finance_ledger_manager() THEN
    RAISE EXCEPTION 'Finance manager access required to lock periods';
  END IF;

  SELECT * INTO period_row FROM public.finance_fiscal_periods WHERE id = _period_id FOR UPDATE;
  IF period_row.id IS NULL THEN RAISE EXCEPTION 'Fiscal period not found'; END IF;
  IF period_row.status = 'locked' THEN RAISE EXCEPTION 'Period is already locked'; END IF;

  UPDATE public.finance_fiscal_periods
  SET status = 'locked', locked_at = now(), locked_by_user_id = auth.uid(), updated_at = now()
  WHERE id = _period_id
  RETURNING * INTO period_row;

  PERFORM public.finance_log_audit_event('finance_fiscal_period', period_row.id, 'locked', jsonb_build_object('label', period_row.label));
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
  IF NOT public.is_finance_ledger_manager() THEN
    RAISE EXCEPTION 'Finance manager access required to reopen periods';
  END IF;

  IF _reason IS NULL OR trim(_reason) = '' THEN
    RAISE EXCEPTION 'Reopen reason is required';
  END IF;

  SELECT * INTO period_row FROM public.finance_fiscal_periods WHERE id = _period_id FOR UPDATE;
  IF period_row.id IS NULL THEN RAISE EXCEPTION 'Fiscal period not found'; END IF;
  IF period_row.status = 'open' THEN RAISE EXCEPTION 'Period is already open'; END IF;

  UPDATE public.finance_fiscal_periods
  SET status = 'open',
      reopened_at = now(),
      reopened_by_user_id = auth.uid(),
      reopen_reason = trim(_reason),
      updated_at = now()
  WHERE id = _period_id
  RETURNING * INTO period_row;

  PERFORM public.finance_log_audit_event(
    'finance_fiscal_period',
    period_row.id,
    'reopened',
    jsonb_build_object('label', period_row.label, 'reason', _reason)
  );
  RETURN period_row;
END;
$$;

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
  row public.finance_opening_balances;
  period_status public.finance_period_status;
BEGIN
  IF NOT public.is_finance_ledger_manager() THEN
    RAISE EXCEPTION 'Finance manager access required';
  END IF;

  SELECT status INTO period_status FROM public.finance_fiscal_periods WHERE id = _fiscal_period_id;
  IF period_status IS NULL THEN RAISE EXCEPTION 'Fiscal period not found'; END IF;
  IF period_status = 'locked' THEN RAISE EXCEPTION 'Cannot edit opening balances in a locked period'; END IF;

  INSERT INTO public.finance_opening_balances (
    fiscal_period_id, account_id, fund_id, ngo_id, debit, credit, memo, created_by_user_id
  ) VALUES (
    _fiscal_period_id, _account_id, _fund_id, _ngo_id, COALESCE(_debit, 0), COALESCE(_credit, 0),
    NULLIF(trim(_memo), ''), auth.uid()
  )
  ON CONFLICT (fiscal_period_id, account_id, COALESCE(fund_id, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(ngo_id, '00000000-0000-0000-0000-000000000000'::uuid))
  DO UPDATE SET
    debit = EXCLUDED.debit,
    credit = EXCLUDED.credit,
    memo = EXCLUDED.memo,
    updated_at = now()
  RETURNING * INTO row;

  RETURN row;
END;
$$;

-- Enhance post_finance_journal_entry to enforce open fiscal period
CREATE OR REPLACE FUNCTION public.post_finance_journal_entry(_entry_id uuid)
RETURNS public.finance_journal_entries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  entry public.finance_journal_entries;
  total_debit numeric(18, 2);
  total_credit numeric(18, 2);
  line_count integer;
  lines_json jsonb;
  resolved_period_id uuid;
BEGIN
  IF NOT public.is_finance_ledger_manager() THEN
    RAISE EXCEPTION 'Finance manager access required to post journal entries';
  END IF;

  SELECT * INTO entry FROM public.finance_journal_entries WHERE id = _entry_id FOR UPDATE;
  IF entry.id IS NULL THEN RAISE EXCEPTION 'Journal entry not found'; END IF;
  IF entry.status NOT IN ('draft', 'pending_approval') THEN
    RAISE EXCEPTION 'Only draft or pending approval entries can be posted. Current status: %', entry.status;
  END IF;

  resolved_period_id := public.get_finance_open_fiscal_period(entry.entry_date, entry.fiscal_period_id);

  SELECT COALESCE(jsonb_agg(jsonb_build_object('account_id', l.account_id, 'debit', l.debit, 'credit', l.credit, 'memo', l.memo) ORDER BY l.line_number), '[]'::jsonb)
  INTO lines_json FROM public.finance_journal_lines l WHERE l.journal_entry_id = _entry_id;

  PERFORM public.validate_finance_journal_accounts(lines_json);

  SELECT COUNT(*), COALESCE(SUM(debit), 0), COALESCE(SUM(credit), 0)
  INTO line_count, total_debit, total_credit
  FROM public.finance_journal_lines WHERE journal_entry_id = _entry_id;

  IF line_count < 2 THEN RAISE EXCEPTION 'Journal entry must contain at least two lines before posting'; END IF;
  IF total_debit <= 0 OR total_credit <= 0 THEN RAISE EXCEPTION 'Journal entry must include both debit and credit amounts'; END IF;
  IF round(total_debit, 2) <> round(total_credit, 2) THEN
    RAISE EXCEPTION 'Journal entry is out of balance. Debits=% Credits=%', total_debit, total_credit;
  END IF;

  UPDATE public.finance_journal_entries
  SET status = 'posted',
      fiscal_period_id = resolved_period_id,
      posted_at = now(),
      approved_by_user_id = COALESCE(approved_by_user_id, auth.uid()),
      updated_at = now()
  WHERE id = _entry_id
  RETURNING * INTO entry;

  PERFORM public.finance_log_audit_event('finance_journal_entry', entry.id, 'posted',
    jsonb_build_object('entry_number', entry.entry_number, 'total_debit', total_debit, 'total_credit', total_credit, 'fiscal_period_id', resolved_period_id));
  RETURN entry;
END;
$$;

ALTER TABLE public.finance_fiscal_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_opening_balances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "finance fiscal periods read" ON public.finance_fiscal_periods;
CREATE POLICY "finance fiscal periods read" ON public.finance_fiscal_periods FOR SELECT TO authenticated USING (public.can_read_finance_ledger());
DROP POLICY IF EXISTS "finance fiscal periods manage" ON public.finance_fiscal_periods;
CREATE POLICY "finance fiscal periods manage" ON public.finance_fiscal_periods FOR ALL TO authenticated USING (public.is_finance_ledger_manager()) WITH CHECK (public.is_finance_ledger_manager());

DROP POLICY IF EXISTS "finance opening balances read" ON public.finance_opening_balances;
CREATE POLICY "finance opening balances read" ON public.finance_opening_balances FOR SELECT TO authenticated USING (public.can_read_finance_ledger());
DROP POLICY IF EXISTS "finance opening balances manage" ON public.finance_opening_balances;
CREATE POLICY "finance opening balances manage" ON public.finance_opening_balances FOR ALL TO authenticated USING (public.is_finance_ledger_manager()) WITH CHECK (public.is_finance_ledger_manager());

GRANT EXECUTE ON FUNCTION public.get_finance_open_fiscal_period(date, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.close_finance_fiscal_period(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lock_finance_fiscal_period(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reopen_finance_fiscal_period(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_finance_opening_balance(uuid, uuid, numeric, numeric, uuid, uuid, text) TO authenticated;
