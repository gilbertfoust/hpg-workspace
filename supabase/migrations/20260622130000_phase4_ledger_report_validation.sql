-- Phase 4: Report snapshots, ledger validation helpers

CREATE TABLE IF NOT EXISTS public.finance_report_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type text NOT NULL,
  label text NOT NULL,
  filters_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  data_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_finance_report_snapshots_type ON public.finance_report_snapshots(report_type, created_at DESC);

CREATE OR REPLACE FUNCTION public.finance_trial_balance_report(
  _start_date date,
  _end_date date,
  _fund_id uuid DEFAULT NULL,
  _ngo_id uuid DEFAULT NULL,
  _department_id uuid DEFAULT NULL,
  _include_voided boolean DEFAULT false
)
RETURNS TABLE (
  account_id uuid,
  account_code text,
  account_name text,
  account_type text,
  total_debit numeric,
  total_credit numeric,
  balance numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH posted_lines AS (
    SELECT l.account_id, l.debit, l.credit
    FROM public.finance_journal_lines l
    JOIN public.finance_journal_entries e ON e.id = l.journal_entry_id
    WHERE e.entry_date BETWEEN _start_date AND _end_date
      AND e.status = 'posted'
      AND (_fund_id IS NULL OR l.fund_id = _fund_id)
      AND (_ngo_id IS NULL OR l.ngo_id = _ngo_id)
      AND (_department_id IS NULL OR l.department_id = _department_id)
  ),
  totals AS (
    SELECT account_id,
      COALESCE(SUM(debit), 0) AS total_debit,
      COALESCE(SUM(credit), 0) AS total_credit
    FROM posted_lines
    GROUP BY account_id
  )
  SELECT
    a.id,
    a.code,
    a.name,
    a.account_type::text,
    t.total_debit,
    t.total_credit,
    t.total_debit - t.total_credit AS balance
  FROM totals t
  JOIN public.finance_accounts a ON a.id = t.account_id
  ORDER BY a.code;
$$;

CREATE OR REPLACE FUNCTION public.finance_general_ledger_report(
  _account_id uuid,
  _start_date date,
  _end_date date,
  _fund_id uuid DEFAULT NULL,
  _ngo_id uuid DEFAULT NULL
)
RETURNS TABLE (
  journal_line_id uuid,
  journal_entry_id uuid,
  entry_number text,
  entry_date date,
  memo text,
  source_type text,
  debit numeric,
  credit numeric,
  running_balance numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH lines AS (
    SELECT
      l.id AS journal_line_id,
      e.id AS journal_entry_id,
      e.entry_number,
      e.entry_date,
      COALESCE(l.memo, e.memo) AS memo,
      e.source_type,
      l.debit,
      l.credit,
      SUM(l.debit - l.credit) OVER (ORDER BY e.entry_date, e.entry_number, l.line_number, l.created_at) AS running_balance
    FROM public.finance_journal_lines l
    JOIN public.finance_journal_entries e ON e.id = l.journal_entry_id
    WHERE l.account_id = _account_id
      AND e.status = 'posted'
      AND e.entry_date BETWEEN _start_date AND _end_date
      AND (_fund_id IS NULL OR l.fund_id = _fund_id)
      AND (_ngo_id IS NULL OR l.ngo_id = _ngo_id)
  )
  SELECT * FROM lines ORDER BY entry_date, entry_number, journal_line_id;
$$;

CREATE OR REPLACE FUNCTION public.finance_validate_trial_balance(
  _start_date date,
  _end_date date
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'total_debit', COALESCE(SUM(total_debit), 0),
    'total_credit', COALESCE(SUM(total_credit), 0),
    'is_balanced', COALESCE(SUM(total_debit), 0) = COALESCE(SUM(total_credit), 0)
  )
  FROM public.finance_trial_balance_report(_start_date, _end_date, NULL, NULL, NULL, false);
$$;

ALTER TABLE public.finance_report_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "finance report snapshots read" ON public.finance_report_snapshots;
CREATE POLICY "finance report snapshots read" ON public.finance_report_snapshots FOR SELECT TO authenticated USING (public.can_read_finance_ledger());
DROP POLICY IF EXISTS "finance report snapshots manage" ON public.finance_report_snapshots;
CREATE POLICY "finance report snapshots manage" ON public.finance_report_snapshots FOR ALL TO authenticated USING (public.is_finance_ledger_manager()) WITH CHECK (public.is_finance_ledger_manager());

GRANT EXECUTE ON FUNCTION public.finance_trial_balance_report(date, date, uuid, uuid, uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finance_general_ledger_report(uuid, date, date, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finance_validate_trial_balance(date, date) TO authenticated;
