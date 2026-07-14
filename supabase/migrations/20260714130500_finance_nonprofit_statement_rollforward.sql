-- Complete nonprofit statements for a soft-close ledger. Cumulative revenue
-- and expense activity rolls into the appropriate net-asset categories even
-- though HPG does not post a year-end nominal-account closing journal.

CREATE OR REPLACE FUNCTION public.finance_statement_of_financial_position(
  _as_of_date date,
  _ngo_id uuid
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH balances AS (
    SELECT
      account.id,
      account.code,
      account.name,
      account.account_type::text AS account_type,
      account.financial_statement_line,
      account.revenue_restriction_class,
      COALESCE(sum(line.debit - line.credit), 0) AS debit_balance,
      COALESCE(sum(line.credit - line.debit), 0) AS credit_balance
    FROM public.finance_accounts account
    LEFT JOIN public.finance_journal_lines line
      ON line.account_id = account.id
      AND (_ngo_id IS NULL OR line.ngo_id = _ngo_id)
      AND EXISTS (
        SELECT 1 FROM public.finance_journal_entries entry
        WHERE entry.id = line.journal_entry_id
          AND entry.status = 'posted'
          AND entry.entry_date <= _as_of_date
      )
    GROUP BY
      account.id, account.code, account.name, account.account_type,
      account.financial_statement_line, account.revenue_restriction_class
  ), totals AS (
    SELECT
      COALESCE(sum(debit_balance) FILTER (WHERE account_type = 'asset'), 0) AS total_assets,
      COALESCE(sum(credit_balance) FILTER (WHERE account_type = 'liability'), 0) AS total_liabilities,
      COALESCE(sum(credit_balance) FILTER (
        WHERE account_type = 'equity'
          AND financial_statement_line = 'net_assets_with_donor_restrictions'
      ), 0)
      + COALESCE(sum(credit_balance) FILTER (
        WHERE account_type = 'revenue'
          AND revenue_restriction_class IN ('with_donor_restrictions', 'grant_restricted')
      ), 0) AS restricted_net_assets,
      COALESCE(sum(credit_balance) FILTER (
        WHERE account_type = 'equity'
          AND financial_statement_line IS DISTINCT FROM 'net_assets_with_donor_restrictions'
      ), 0)
      + COALESCE(sum(credit_balance) FILTER (
        WHERE account_type = 'revenue'
          AND COALESCE(revenue_restriction_class, 'without_donor_restrictions')
              NOT IN ('with_donor_restrictions', 'grant_restricted')
      ), 0)
      - COALESCE(sum(debit_balance) FILTER (WHERE account_type = 'expense'), 0) AS unrestricted_net_assets
    FROM balances
  )
  SELECT jsonb_build_object(
    'assets', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('code', code, 'name', name, 'balance', debit_balance) ORDER BY code)
      FROM balances WHERE account_type = 'asset' AND debit_balance <> 0
    ), '[]'::jsonb),
    'liabilities', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('code', code, 'name', name, 'balance', credit_balance) ORDER BY code)
      FROM balances WHERE account_type = 'liability' AND credit_balance <> 0
    ), '[]'::jsonb),
    'net_assets_without_restrictions', totals.unrestricted_net_assets,
    'net_assets_with_restrictions', totals.restricted_net_assets,
    'total_assets', totals.total_assets,
    'total_liabilities', totals.total_liabilities,
    'total_net_assets', totals.unrestricted_net_assets + totals.restricted_net_assets,
    'total_liabilities_and_net_assets',
      totals.total_liabilities + totals.unrestricted_net_assets + totals.restricted_net_assets,
    'statement_difference', round(
      totals.total_assets
      - totals.total_liabilities
      - totals.unrestricted_net_assets
      - totals.restricted_net_assets,
      2
    ),
    'statement_is_balanced', abs(round(
      totals.total_assets
      - totals.total_liabilities
      - totals.unrestricted_net_assets
      - totals.restricted_net_assets,
      2
    )) <= 0.005,
    'as_of_date', _as_of_date,
    'ngo_id', _ngo_id
  ) FROM totals;
$$;

CREATE OR REPLACE FUNCTION public.finance_statement_of_activities(
  _start_date date,
  _end_date date,
  _ngo_id uuid
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH activity AS (
    SELECT
      account.id,
      account.account_type::text AS account_type,
      account.revenue_restriction_class,
      account.expense_functional_class,
      CASE
        WHEN account.account_type = 'revenue' THEN COALESCE(sum(line.credit - line.debit), 0)
        ELSE COALESCE(sum(line.debit - line.credit), 0)
      END AS amount
    FROM public.finance_accounts account
    LEFT JOIN public.finance_journal_lines line
      ON line.account_id = account.id
      AND (_ngo_id IS NULL OR line.ngo_id = _ngo_id)
      AND EXISTS (
        SELECT 1 FROM public.finance_journal_entries entry
        WHERE entry.id = line.journal_entry_id
          AND entry.status = 'posted'
          AND entry.entry_date BETWEEN _start_date AND _end_date
      )
    WHERE account.account_type IN ('revenue', 'expense')
    GROUP BY account.id, account.account_type, account.revenue_restriction_class, account.expense_functional_class
  ), totals AS (
    SELECT
      COALESCE(sum(amount) FILTER (
        WHERE account_type = 'revenue'
          AND COALESCE(revenue_restriction_class, 'without_donor_restrictions')
              NOT IN ('with_donor_restrictions', 'grant_restricted')
      ), 0) AS revenue_without_restrictions,
      COALESCE(sum(amount) FILTER (
        WHERE account_type = 'revenue'
          AND revenue_restriction_class IN ('with_donor_restrictions', 'grant_restricted')
      ), 0) AS revenue_with_restrictions,
      COALESCE(sum(amount) FILTER (
        WHERE account_type = 'revenue' AND revenue_restriction_class = 'program_released'
      ), 0) AS net_assets_released,
      COALESCE(sum(amount) FILTER (
        WHERE account_type = 'expense' AND expense_functional_class = 'program'
      ), 0) AS program_expenses,
      COALESCE(sum(amount) FILTER (
        WHERE account_type = 'expense' AND expense_functional_class = 'management_general'
      ), 0) AS management_general_expenses,
      COALESCE(sum(amount) FILTER (
        WHERE account_type = 'expense' AND expense_functional_class = 'fundraising'
      ), 0) AS fundraising_expenses,
      COALESCE(sum(amount) FILTER (
        WHERE account_type = 'expense' AND expense_functional_class = 'pass_through'
      ), 0) AS pass_through_expenses,
      COALESCE(sum(amount) FILTER (
        WHERE account_type = 'expense' AND expense_functional_class IS NULL
      ), 0) AS other_expenses,
      COALESCE(sum(amount) FILTER (WHERE account_type = 'revenue'), 0) AS total_revenue,
      COALESCE(sum(amount) FILTER (WHERE account_type = 'expense'), 0) AS total_expenses
    FROM activity
  )
  SELECT jsonb_build_object(
    'revenue_without_restrictions', revenue_without_restrictions,
    'revenue_with_restrictions', revenue_with_restrictions,
    'net_assets_released', net_assets_released,
    'total_revenue', total_revenue,
    'program_expenses', program_expenses,
    'management_general_expenses', management_general_expenses,
    'fundraising_expenses', fundraising_expenses,
    'pass_through_expenses', pass_through_expenses,
    'other_expenses', other_expenses,
    'total_expenses', total_expenses,
    'change_in_net_assets', total_revenue - total_expenses,
    'start_date', _start_date,
    'end_date', _end_date,
    'ngo_id', _ngo_id
  ) FROM totals;
$$;

REVOKE ALL ON FUNCTION public.finance_statement_of_financial_position(date, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finance_statement_of_financial_position(date, uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.finance_statement_of_activities(date, date, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finance_statement_of_activities(date, date, uuid) TO authenticated;
