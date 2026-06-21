-- Phase 5: Nonprofit financial statement report functions

CREATE OR REPLACE FUNCTION public.finance_statement_of_financial_position(
  _as_of_date date,
  _entity_scope text DEFAULT NULL
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
  WITH lines AS (
    SELECT l.account_id, l.debit, l.credit
    FROM public.finance_journal_lines l
    JOIN public.finance_journal_entries e ON e.id = l.journal_entry_id
    JOIN public.finance_accounts a ON a.id = l.account_id
    WHERE e.status = 'posted' AND e.entry_date <= _as_of_date
      AND (_entity_scope IS NULL OR a.entity_scope = _entity_scope)
  ),
  balances AS (
    SELECT a.id, a.code, a.name, a.account_type::text AS account_type,
      a.financial_statement_line, a.account_subtype,
      COALESCE(SUM(l.debit - l.credit), 0) AS balance
    FROM public.finance_accounts a
    LEFT JOIN lines l ON l.account_id = a.id
  WHERE a.account_type IN ('asset', 'liability', 'equity')
    AND (_entity_scope IS NULL OR a.entity_scope = _entity_scope)
    GROUP BY a.id, a.code, a.name, a.account_type, a.financial_statement_line, a.account_subtype
  )
  SELECT jsonb_build_object(
    'assets', COALESCE((SELECT jsonb_agg(jsonb_build_object('code', code, 'name', name, 'balance', balance) ORDER BY code) FROM balances WHERE account_type = 'asset' AND balance <> 0), '[]'::jsonb),
    'liabilities', COALESCE((SELECT jsonb_agg(jsonb_build_object('code', code, 'name', name, 'balance', balance) ORDER BY code) FROM balances WHERE account_type = 'liability' AND balance <> 0), '[]'::jsonb),
    'net_assets_without_restrictions', COALESCE((SELECT SUM(balance) FROM balances WHERE financial_statement_line = 'net_assets_without_donor_restrictions'), 0),
    'net_assets_with_restrictions', COALESCE((SELECT SUM(balance) FROM balances WHERE financial_statement_line = 'net_assets_with_donor_restrictions'), 0),
    'total_net_assets', COALESCE((SELECT SUM(balance) FROM balances WHERE account_type = 'equity'), 0),
    'as_of_date', _as_of_date
  ) INTO result;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.finance_statement_of_activities(
  _start_date date,
  _end_date date,
  _entity_scope text DEFAULT NULL
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
  WITH lines AS (
    SELECT l.account_id, l.debit, l.credit
    FROM public.finance_journal_lines l
    JOIN public.finance_journal_entries e ON e.id = l.journal_entry_id
    JOIN public.finance_accounts a ON a.id = l.account_id
    WHERE e.status = 'posted'
      AND e.entry_date BETWEEN _start_date AND _end_date
      AND (_entity_scope IS NULL OR a.entity_scope = _entity_scope)
  ),
  activity AS (
    SELECT a.id, a.code, a.name, a.account_type::text AS account_type,
      a.revenue_restriction_class, a.expense_functional_class, a.financial_statement_line,
      COALESCE(SUM(l.credit - l.debit), 0) AS amount
    FROM public.finance_accounts a
    LEFT JOIN lines l ON l.account_id = a.id
    WHERE a.account_type IN ('revenue', 'expense')
      AND (_entity_scope IS NULL OR a.entity_scope = _entity_scope)
    GROUP BY a.id, a.code, a.name, a.account_type, a.revenue_restriction_class, a.expense_functional_class, a.financial_statement_line
  )
  SELECT jsonb_build_object(
    'revenue_without_restrictions', COALESCE((SELECT SUM(amount) FROM activity WHERE account_type = 'revenue' AND revenue_restriction_class = 'without_donor_restrictions'), 0),
    'revenue_with_restrictions', COALESCE((SELECT SUM(amount) FROM activity WHERE account_type = 'revenue' AND revenue_restriction_class IN ('with_donor_restrictions', 'grant_restricted')), 0),
    'net_assets_released', COALESCE((SELECT SUM(amount) FROM activity WHERE revenue_restriction_class = 'program_released'), 0),
    'program_expenses', COALESCE((SELECT SUM(-amount) FROM activity WHERE account_type = 'expense' AND expense_functional_class = 'program'), 0),
    'management_general_expenses', COALESCE((SELECT SUM(-amount) FROM activity WHERE account_type = 'expense' AND expense_functional_class = 'management_general'), 0),
    'fundraising_expenses', COALESCE((SELECT SUM(-amount) FROM activity WHERE account_type = 'expense' AND expense_functional_class = 'fundraising'), 0),
    'change_in_net_assets', COALESCE((SELECT SUM(amount) FROM activity), 0),
    'start_date', _start_date,
    'end_date', _end_date
  ) INTO result;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.finance_statement_of_cash_flows(
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
  result jsonb;
  beginning_cash numeric(18, 2);
  ending_cash numeric(18, 2);
BEGIN
  SELECT COALESCE(SUM(l.debit - l.credit), 0) INTO beginning_cash
  FROM public.finance_journal_lines l
  JOIN public.finance_journal_entries e ON e.id = l.journal_entry_id
  JOIN public.finance_accounts a ON a.id = l.account_id
  WHERE e.status = 'posted' AND e.entry_date < _start_date AND a.is_cash_account = true;

  SELECT COALESCE(SUM(l.debit - l.credit), 0) INTO ending_cash
  FROM public.finance_journal_lines l
  JOIN public.finance_journal_entries e ON e.id = l.journal_entry_id
  JOIN public.finance_accounts a ON a.id = l.account_id
  WHERE e.status = 'posted' AND e.entry_date <= _end_date AND a.is_cash_account = true;

  WITH period_lines AS (
    SELECT a.account_type::text AS account_type, a.is_cash_account, l.debit, l.credit
    FROM public.finance_journal_lines l
    JOIN public.finance_journal_entries e ON e.id = l.journal_entry_id
    JOIN public.finance_accounts a ON a.id = l.account_id
    WHERE e.status = 'posted' AND e.entry_date BETWEEN _start_date AND _end_date
  )
  SELECT jsonb_build_object(
    'operating_cash_flow', COALESCE((SELECT SUM(credit - debit) FROM period_lines WHERE account_type IN ('revenue', 'expense')), 0),
    'investing_cash_flow', COALESCE((SELECT SUM(credit - debit) FROM period_lines WHERE account_type = 'asset' AND is_cash_account = false), 0),
    'financing_cash_flow', COALESCE((SELECT SUM(credit - debit) FROM period_lines WHERE account_type IN ('liability', 'equity')), 0),
    'beginning_cash_balance', beginning_cash,
    'ending_cash_balance', ending_cash,
    'start_date', _start_date,
    'end_date', _end_date
  ) INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.finance_statement_of_financial_position(date, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finance_statement_of_activities(date, date, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finance_statement_of_cash_flows(date, date) TO authenticated;
