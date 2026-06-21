-- Phase 10: Budget vs actual and grant financial reporting

CREATE OR REPLACE FUNCTION public.finance_budget_vs_actual_report(
  _budget_id uuid,
  _start_date date DEFAULT NULL,
  _end_date date DEFAULT NULL
)
RETURNS TABLE (
  account_id uuid,
  account_code text,
  account_name text,
  budget_amount numeric,
  actual_amount numeric,
  variance numeric,
  variance_pct numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH budget AS (
    SELECT bl.account_id, SUM(bl.amount) AS budget_amount
    FROM public.finance_budget_lines bl
    WHERE bl.budget_id = _budget_id
    GROUP BY bl.account_id
  ),
  actuals AS (
    SELECT l.account_id, SUM(l.debit - l.credit) AS actual_amount
    FROM public.finance_journal_lines l
    JOIN public.finance_journal_entries e ON e.id = l.journal_entry_id
    JOIN public.finance_budgets b ON b.id = _budget_id
    WHERE e.status = 'posted'
      AND l.account_id IN (SELECT account_id FROM budget)
      AND (_start_date IS NULL OR e.entry_date >= make_date(b.fiscal_year, 1, 1))
      AND (_end_date IS NULL OR e.entry_date <= make_date(b.fiscal_year, 12, 31))
    GROUP BY l.account_id
  )
  SELECT
    a.id,
    a.code,
    a.name,
    COALESCE(b.budget_amount, 0),
    COALESCE(ac.actual_amount, 0),
    COALESCE(b.budget_amount, 0) - COALESCE(ac.actual_amount, 0) AS variance,
    CASE WHEN COALESCE(b.budget_amount, 0) = 0 THEN NULL
      ELSE round((COALESCE(ac.actual_amount, 0) / b.budget_amount) * 100, 2)
    END AS variance_pct
  FROM budget b
  JOIN public.finance_accounts a ON a.id = b.account_id
  LEFT JOIN actuals ac ON ac.account_id = b.account_id
  ORDER BY a.code;
$$;

CREATE OR REPLACE FUNCTION public.finance_grant_financial_report(
  _grant_application_id uuid,
  _start_date date DEFAULT NULL,
  _end_date date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  WITH grant_lines AS (
    SELECT l.account_id, l.debit, l.credit, e.entry_date
    FROM public.finance_journal_lines l
    JOIN public.finance_journal_entries e ON e.id = l.journal_entry_id
    WHERE e.status = 'posted'
      AND l.grant_application_id = _grant_application_id
      AND (_start_date IS NULL OR e.entry_date >= _start_date)
      AND (_end_date IS NULL OR e.entry_date <= _end_date)
  ),
  totals AS (
    SELECT
      COALESCE(SUM(CASE WHEN a.account_type = 'revenue' THEN credit - debit ELSE 0 END), 0) AS funds_received,
      COALESCE(SUM(CASE WHEN a.account_type = 'expense' THEN debit - credit ELSE 0 END), 0) AS funds_spent
    FROM grant_lines gl
    JOIN public.finance_accounts a ON a.id = gl.account_id
  )
  SELECT jsonb_build_object(
    'grant_application_id', _grant_application_id,
    'funds_received', (SELECT funds_received FROM totals),
    'funds_spent', (SELECT funds_spent FROM totals),
    'remaining_balance', (SELECT funds_received - funds_spent FROM totals),
    'start_date', _start_date,
    'end_date', _end_date
  ) INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.finance_budget_vs_actual_report(uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finance_grant_financial_report(uuid, date, date) TO authenticated;
