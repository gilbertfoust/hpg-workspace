-- Phase 11: Compliance reporting and year-end package

CREATE TABLE IF NOT EXISTS public.finance_year_end_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fiscal_year integer NOT NULL,
  label text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  fiscal_period_id uuid REFERENCES public.finance_fiscal_periods(id) ON DELETE SET NULL,
  package_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  locked_at timestamptz,
  locked_by_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT finance_year_end_packages_status_check CHECK (status IN ('draft', 'final', 'locked')),
  CONSTRAINT finance_year_end_packages_year_unique UNIQUE (fiscal_year, label)
);

CREATE OR REPLACE FUNCTION public.finance_functional_expense_report(
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
    'program', COALESCE(SUM(CASE WHEN a.expense_functional_class = 'program' THEN l.debit - l.credit ELSE 0 END), 0),
    'management_general', COALESCE(SUM(CASE WHEN a.expense_functional_class = 'management_general' THEN l.debit - l.credit ELSE 0 END), 0),
    'fundraising', COALESCE(SUM(CASE WHEN a.expense_functional_class = 'fundraising' THEN l.debit - l.credit ELSE 0 END), 0),
    'pass_through', COALESCE(SUM(CASE WHEN a.expense_functional_class = 'pass_through' THEN l.debit - l.credit ELSE 0 END), 0),
    'start_date', _start_date,
    'end_date', _end_date
  )
  FROM public.finance_journal_lines l
  JOIN public.finance_journal_entries e ON e.id = l.journal_entry_id
  JOIN public.finance_accounts a ON a.id = l.account_id
  WHERE e.status = 'posted'
    AND e.entry_date BETWEEN _start_date AND _end_date
    AND a.account_type = 'expense';
$$;

CREATE OR REPLACE FUNCTION public.finance_restricted_fund_report(_as_of_date date)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'funds', COALESCE(jsonb_agg(jsonb_build_object(
      'fund_id', f.id,
      'fund_name', f.name,
      'fund_type', f.fund_type,
      'ngo_id', f.ngo_id,
      'balance', balances.balance
    ) ORDER BY f.name), '[]'::jsonb),
    'as_of_date', _as_of_date
  )
  FROM (
    SELECT l.fund_id, SUM(l.credit - l.debit) AS balance
    FROM public.finance_journal_lines l
    JOIN public.finance_journal_entries e ON e.id = l.journal_entry_id
    WHERE e.status = 'posted' AND e.entry_date <= _as_of_date AND l.fund_id IS NOT NULL
    GROUP BY l.fund_id
  ) balances
  JOIN public.finance_funds f ON f.id = balances.fund_id;
$$;

CREATE OR REPLACE FUNCTION public.generate_finance_year_end_package(
  _fiscal_year integer,
  _label text DEFAULT NULL
)
RETURNS public.finance_year_end_packages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pkg public.finance_year_end_packages;
  period_row public.finance_fiscal_periods;
  year_start date;
  year_end date;
  package_data jsonb;
BEGIN
  IF NOT public.is_finance_ledger_manager() THEN RAISE EXCEPTION 'Finance manager access required'; END IF;

  SELECT * INTO period_row
  FROM public.finance_fiscal_periods
  WHERE fiscal_year = _fiscal_year AND period_type = 'year'
  ORDER BY start_date DESC
  LIMIT 1;

  year_start := make_date(_fiscal_year, 1, 1);
  year_end := make_date(_fiscal_year, 12, 31);
  IF period_row.id IS NOT NULL THEN
    year_start := period_row.start_date;
    year_end := period_row.end_date;
  END IF;

  package_data := jsonb_build_object(
    'fiscal_year', _fiscal_year,
    'trial_balance_validation', public.finance_validate_trial_balance(year_start, year_end),
    'statement_of_financial_position', public.finance_statement_of_financial_position(year_end, NULL),
    'statement_of_activities', public.finance_statement_of_activities(year_start, year_end, NULL),
    'statement_of_cash_flows', public.finance_statement_of_cash_flows(year_start, year_end),
    'functional_expense_report', public.finance_functional_expense_report(year_start, year_end),
    'restricted_fund_report', public.finance_restricted_fund_report(year_end),
    'generated_at', now()
  );

  INSERT INTO public.finance_year_end_packages (
    fiscal_year, label, status, fiscal_period_id, package_json, created_by_user_id
  ) VALUES (
    _fiscal_year,
    COALESCE(NULLIF(trim(_label), ''), 'FY' || _fiscal_year::text || ' Audit Package'),
    'draft',
    period_row.id,
    package_data,
    auth.uid()
  )
  ON CONFLICT (fiscal_year, label) DO UPDATE SET
    package_json = EXCLUDED.package_json,
    fiscal_period_id = EXCLUDED.fiscal_period_id,
    updated_at = now()
  RETURNING * INTO pkg;

  PERFORM public.finance_log_audit_event('finance_year_end_package', pkg.id, 'generated',
    jsonb_build_object('fiscal_year', _fiscal_year));
  RETURN pkg;
END;
$$;

ALTER TABLE public.finance_year_end_packages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "finance year end packages read" ON public.finance_year_end_packages;
CREATE POLICY "finance year end packages read" ON public.finance_year_end_packages FOR SELECT TO authenticated USING (public.can_read_finance_ledger() OR public.is_finance_auditor());
DROP POLICY IF EXISTS "finance year end packages manage" ON public.finance_year_end_packages;
CREATE POLICY "finance year end packages manage" ON public.finance_year_end_packages FOR ALL TO authenticated USING (public.is_finance_ledger_manager()) WITH CHECK (public.is_finance_ledger_manager());

GRANT EXECUTE ON FUNCTION public.finance_functional_expense_report(date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finance_restricted_fund_report(date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_finance_year_end_package(integer, text) TO authenticated;
