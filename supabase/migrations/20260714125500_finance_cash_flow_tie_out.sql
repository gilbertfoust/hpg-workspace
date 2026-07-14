-- Classify actual cash movements, not every revenue/expense/AP accrual. This
-- keeps the Statement of Cash Flows tied to beginning and ending cash.

CREATE OR REPLACE FUNCTION public.finance_statement_of_cash_flows(
  _start_date date,
  _end_date date,
  _ngo_id uuid
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
  operating_cash numeric(18, 2);
  investing_cash numeric(18, 2);
  financing_cash numeric(18, 2);
  net_change numeric(18, 2);
BEGIN
  SELECT COALESCE(sum(line.debit - line.credit), 0) INTO beginning_cash
  FROM public.finance_journal_lines line
  JOIN public.finance_journal_entries entry ON entry.id = line.journal_entry_id
  JOIN public.finance_accounts account ON account.id = line.account_id
  WHERE entry.status = 'posted'
    AND (
      entry.entry_date < _start_date
      OR (entry.entry_date = _start_date AND entry.source_type = 'finance_opening_balance')
    )
    AND account.is_cash_account
    AND (_ngo_id IS NULL OR line.ngo_id = _ngo_id);

  SELECT COALESCE(sum(line.debit - line.credit), 0) INTO ending_cash
  FROM public.finance_journal_lines line
  JOIN public.finance_journal_entries entry ON entry.id = line.journal_entry_id
  JOIN public.finance_accounts account ON account.id = line.account_id
  WHERE entry.status = 'posted'
    AND entry.entry_date <= _end_date
    AND account.is_cash_account
    AND (_ngo_id IS NULL OR line.ngo_id = _ngo_id);

  WITH entry_classification AS (
    SELECT
      entry.id,
      COALESCE(sum(line.debit - line.credit) FILTER (WHERE account.is_cash_account), 0) AS cash_movement,
      bool_or(
        NOT account.is_cash_account
        AND account.account_type = 'asset'
        AND COALESCE(account.account_subtype, '') IN (
          'fixed_asset', 'property', 'equipment', 'investment', 'investments', 'intangible'
        )
      ) AS is_investing,
      bool_or(
        NOT account.is_cash_account
        AND (
          account.account_type = 'equity'
          OR (
            account.account_type = 'liability'
            AND COALESCE(account.account_subtype, '') IN (
              'loan', 'long_term_debt', 'line_of_credit', 'notes_payable'
            )
          )
        )
      ) AS is_financing
    FROM public.finance_journal_entries entry
    JOIN public.finance_journal_lines line ON line.journal_entry_id = entry.id
    JOIN public.finance_accounts account ON account.id = line.account_id
    WHERE entry.status = 'posted'
      AND entry.entry_date BETWEEN _start_date AND _end_date
      AND entry.source_type IS DISTINCT FROM 'finance_opening_balance'
      AND (_ngo_id IS NULL OR entry.ngo_id = _ngo_id)
    GROUP BY entry.id
  )
  SELECT
    COALESCE(sum(cash_movement) FILTER (WHERE NOT is_investing AND NOT is_financing), 0),
    COALESCE(sum(cash_movement) FILTER (WHERE is_investing), 0),
    COALESCE(sum(cash_movement) FILTER (WHERE NOT is_investing AND is_financing), 0)
  INTO operating_cash, investing_cash, financing_cash
  FROM entry_classification;

  net_change := round(ending_cash - beginning_cash, 2);
  result := jsonb_build_object(
    'operating_cash_flow', round(operating_cash, 2),
    'investing_cash_flow', round(investing_cash, 2),
    'financing_cash_flow', round(financing_cash, 2),
    'net_change_in_cash', net_change,
    'beginning_cash_balance', round(beginning_cash, 2),
    'ending_cash_balance', round(ending_cash, 2),
    'cash_flow_ties', abs(round(operating_cash + investing_cash + financing_cash, 2) - net_change) <= 0.005,
    'start_date', _start_date,
    'end_date', _end_date,
    'ngo_id', _ngo_id
  );
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.finance_statement_of_cash_flows(date, date, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finance_statement_of_cash_flows(date, date, uuid) TO authenticated;
