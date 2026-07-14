-- Finance entity ledger authority
--
-- Establishes the finance_* ledger as the authoritative accounting system for
-- both consolidated HPG reporting and individual NGO books. Ordinary journal
-- entries are single-entity, fiscal periods are entity-aware, and official
-- statements accept the selected NGO as a first-class filter.

-- ---------------------------------------------------------------------------
-- Secure the canonical NGO directory before using it as an accounting scope.
-- ---------------------------------------------------------------------------

ALTER TABLE public.ngos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can create NGOs" ON public.ngos;
DROP POLICY IF EXISTS "Internal users can view NGOs" ON public.ngos;
CREATE POLICY "Internal users can view NGOs"
  ON public.ngos FOR SELECT TO authenticated
  USING (public.is_internal_user());

DROP POLICY IF EXISTS "Internal users can create NGOs" ON public.ngos;
CREATE POLICY "Internal users can create NGOs"
  ON public.ngos FOR INSERT TO authenticated
  WITH CHECK (public.is_internal_user());

DROP POLICY IF EXISTS "Internal users can update NGOs" ON public.ngos;
CREATE POLICY "Internal users can update NGOs"
  ON public.ngos FOR UPDATE TO authenticated
  USING (public.is_internal_user())
  WITH CHECK (public.is_internal_user());

-- ---------------------------------------------------------------------------
-- Entity headers and entity-aware fiscal calendars.
-- ---------------------------------------------------------------------------

ALTER TABLE public.finance_journal_entries
  ADD COLUMN IF NOT EXISTS ngo_id uuid REFERENCES public.ngos(id) ON DELETE RESTRICT;

WITH entry_scope AS (
  SELECT
    journal_entry_id,
    min(ngo_id::text)::uuid AS ngo_id,
    count(DISTINCT ngo_id) AS ngo_count
  FROM public.finance_journal_lines
  WHERE ngo_id IS NOT NULL
  GROUP BY journal_entry_id
)
UPDATE public.finance_journal_entries entry
SET ngo_id = scope.ngo_id
FROM entry_scope scope
WHERE scope.journal_entry_id = entry.id
  AND scope.ngo_count = 1
  AND entry.ngo_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_finance_journal_entries_ngo
  ON public.finance_journal_entries(ngo_id, entry_date DESC);

ALTER TABLE public.finance_fiscal_periods
  ADD COLUMN IF NOT EXISTS ngo_id uuid REFERENCES public.ngos(id) ON DELETE CASCADE;

DROP INDEX IF EXISTS public.idx_finance_fiscal_periods_label_year;
CREATE UNIQUE INDEX IF NOT EXISTS idx_finance_fiscal_periods_scope_period
  ON public.finance_fiscal_periods(
    COALESCE(ngo_id, '00000000-0000-0000-0000-000000000000'::uuid),
    fiscal_year,
    period_type,
    COALESCE(period_number, 0)
  );

CREATE INDEX IF NOT EXISTS idx_finance_fiscal_periods_ngo_dates
  ON public.finance_fiscal_periods(ngo_id, start_date, end_date, status);

CREATE OR REPLACE FUNCTION public.finance_ensure_fiscal_calendar(
  _ngo_id uuid,
  _fiscal_year integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  month_number integer;
  quarter_number integer;
  period_start date;
BEGIN
  IF _fiscal_year < 1900 OR _fiscal_year > 2200 THEN
    RAISE EXCEPTION 'Fiscal year is outside the supported range';
  END IF;

  IF _ngo_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.ngos WHERE id = _ngo_id) THEN
    RAISE EXCEPTION 'NGO not found';
  END IF;

  FOR month_number IN 1..12 LOOP
    period_start := make_date(_fiscal_year, month_number, 1);
    INSERT INTO public.finance_fiscal_periods (
      ngo_id, label, fiscal_year, period_number, period_type, start_date, end_date, status
    ) VALUES (
      _ngo_id,
      to_char(period_start, 'Mon YYYY'),
      _fiscal_year,
      month_number,
      'month',
      period_start,
      (period_start + interval '1 month - 1 day')::date,
      'open'
    ) ON CONFLICT DO NOTHING;
  END LOOP;

  FOR quarter_number IN 1..4 LOOP
    period_start := make_date(_fiscal_year, ((quarter_number - 1) * 3) + 1, 1);
    INSERT INTO public.finance_fiscal_periods (
      ngo_id, label, fiscal_year, period_number, period_type, start_date, end_date, status
    ) VALUES (
      _ngo_id,
      'Q' || quarter_number || ' ' || _fiscal_year,
      _fiscal_year,
      quarter_number,
      'quarter',
      period_start,
      (period_start + interval '3 months - 1 day')::date,
      'open'
    ) ON CONFLICT DO NOTHING;
  END LOOP;

  INSERT INTO public.finance_fiscal_periods (
    ngo_id, label, fiscal_year, period_number, period_type, start_date, end_date, status
  ) VALUES (
    _ngo_id,
    'FY' || _fiscal_year,
    _fiscal_year,
    1,
    'year',
    make_date(_fiscal_year, 1, 1),
    make_date(_fiscal_year, 12, 31),
    'open'
  ) ON CONFLICT DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.finance_seed_ngo_calendar_on_create()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  year_number integer;
BEGIN
  FOR year_number IN (extract(year FROM CURRENT_DATE)::integer - 1)..(extract(year FROM CURRENT_DATE)::integer + 1) LOOP
    PERFORM public.finance_ensure_fiscal_calendar(NEW.id, year_number);
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_finance_seed_ngo_calendar ON public.ngos;
CREATE TRIGGER trg_finance_seed_ngo_calendar
  AFTER INSERT ON public.ngos
  FOR EACH ROW EXECUTE FUNCTION public.finance_seed_ngo_calendar_on_create();

DO $$
DECLARE
  ngo_record record;
  year_number integer;
BEGIN
  FOR year_number IN (extract(year FROM CURRENT_DATE)::integer - 1)..(extract(year FROM CURRENT_DATE)::integer + 1) LOOP
    PERFORM public.finance_ensure_fiscal_calendar(NULL, year_number);
    FOR ngo_record IN SELECT id FROM public.ngos LOOP
      PERFORM public.finance_ensure_fiscal_calendar(ngo_record.id, year_number);
    END LOOP;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_finance_open_fiscal_period(
  _entry_date date,
  _fiscal_period_id uuid,
  _ngo_id uuid
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
      AND fp.ngo_id IS NOT DISTINCT FROM _ngo_id
      AND _entry_date BETWEEN fp.start_date AND fp.end_date
      AND fp.status = 'open';

    IF resolved_id IS NULL THEN
      RAISE EXCEPTION 'Fiscal period is missing, belongs to another entity, is closed or locked, or does not cover entry date %', _entry_date;
    END IF;
    RETURN resolved_id;
  END IF;

  SELECT fp.id INTO resolved_id
  FROM public.finance_fiscal_periods fp
  WHERE fp.ngo_id IS NOT DISTINCT FROM _ngo_id
    AND _entry_date BETWEEN fp.start_date AND fp.end_date
    AND fp.status = 'open'
  ORDER BY
    CASE fp.period_type WHEN 'month' THEN 1 WHEN 'quarter' THEN 2 ELSE 3 END,
    fp.start_date DESC
  LIMIT 1;

  IF resolved_id IS NULL THEN
    RAISE EXCEPTION 'No open finance fiscal period found for this entity on date %', _entry_date;
  END IF;

  RETURN resolved_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Single-entity journal contract.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.finance_validate_journal_entity_scope(_entry_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  entry_ngo_id uuid;
  entry_source_type text;
BEGIN
  SELECT ngo_id, source_type INTO entry_ngo_id, entry_source_type
  FROM public.finance_journal_entries
  WHERE id = _entry_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Journal entry not found';
  END IF;

  IF entry_source_type IN ('inter_ngo_transfer', 'consolidation', 'elimination') THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.finance_journal_lines line
    WHERE line.journal_entry_id = _entry_id
      AND line.ngo_id IS DISTINCT FROM entry_ngo_id
  ) THEN
    RAISE EXCEPTION 'Ordinary journal entries must contain only the selected NGO. Use the inter-NGO transfer workflow for cross-entity activity.';
  END IF;
END;
$$;

DROP FUNCTION IF EXISTS public.save_finance_journal_entry(uuid, date, text, text, uuid, jsonb);
DROP FUNCTION IF EXISTS public.save_finance_journal_entry(uuid, date, text, text, uuid, uuid, jsonb);

CREATE FUNCTION public.save_finance_journal_entry(
  _entry_id uuid DEFAULT NULL,
  _entry_date date DEFAULT CURRENT_DATE,
  _memo text DEFAULT NULL,
  _source_type text DEFAULT NULL,
  _source_id uuid DEFAULT NULL,
  _fiscal_period_id uuid DEFAULT NULL,
  _ngo_id uuid DEFAULT NULL,
  _lines jsonb DEFAULT '[]'::jsonb
)
RETURNS public.finance_journal_entries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  entry public.finance_journal_entries;
  line jsonb;
  line_no integer := 0;
  resolved_period_id uuid;
  supplied_line_ngo uuid;
  normalized_source_type text := NULLIF(trim(_source_type), '');
BEGIN
  IF auth.uid() IS NULL OR (NOT public.is_finance_ledger_manager() AND NOT public.can_write_finance_drafts()) THEN
    RAISE EXCEPTION 'Finance access required to save journal entries';
  END IF;

  IF _ngo_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.ngos WHERE id = _ngo_id) THEN
    RAISE EXCEPTION 'Selected NGO does not exist';
  END IF;

  IF _fiscal_period_id IS NOT NULL THEN
    resolved_period_id := public.get_finance_open_fiscal_period(_entry_date, _fiscal_period_id, _ngo_id);
  END IF;

  IF _entry_id IS NOT NULL THEN
    SELECT * INTO entry FROM public.finance_journal_entries WHERE id = _entry_id FOR UPDATE;
    IF entry.id IS NULL THEN RAISE EXCEPTION 'Journal entry not found'; END IF;
    IF entry.status <> 'draft' THEN RAISE EXCEPTION 'Only draft journal entries can be edited'; END IF;

    UPDATE public.finance_journal_entries
    SET entry_date = _entry_date,
        memo = NULLIF(trim(_memo), ''),
        source_type = normalized_source_type,
        source_id = _source_id,
        fiscal_period_id = resolved_period_id,
        ngo_id = _ngo_id,
        updated_at = now()
    WHERE id = _entry_id
    RETURNING * INTO entry;

    DELETE FROM public.finance_journal_lines WHERE journal_entry_id = _entry_id;
  ELSE
    INSERT INTO public.finance_journal_entries (
      entry_date, memo, source_type, source_id, fiscal_period_id, ngo_id,
      status, created_by_user_id, entry_number
    ) VALUES (
      _entry_date,
      NULLIF(trim(_memo), ''),
      normalized_source_type,
      _source_id,
      resolved_period_id,
      _ngo_id,
      'draft',
      auth.uid(),
      ''
    ) RETURNING * INTO entry;
  END IF;

  FOR line IN SELECT value FROM jsonb_array_elements(COALESCE(_lines, '[]'::jsonb)) LOOP
    IF COALESCE(line->>'account_id', '') = '' THEN CONTINUE; END IF;
    line_no := line_no + 1;
    supplied_line_ngo := NULLIF(line->>'ngo_id', '')::uuid;

    IF normalized_source_type NOT IN ('inter_ngo_transfer', 'consolidation', 'elimination')
       AND supplied_line_ngo IS DISTINCT FROM _ngo_id
       AND supplied_line_ngo IS NOT NULL THEN
      RAISE EXCEPTION 'A journal line belongs to a different NGO than the selected entity';
    END IF;

    INSERT INTO public.finance_journal_lines (
      journal_entry_id, account_id, debit, credit, memo,
      fund_id, ngo_id, department_id, dimension_id, document_id,
      grant_application_id, work_item_id, line_number
    ) VALUES (
      entry.id,
      (line->>'account_id')::uuid,
      COALESCE((line->>'debit')::numeric, 0),
      COALESCE((line->>'credit')::numeric, 0),
      NULLIF(trim(line->>'memo'), ''),
      NULLIF(line->>'fund_id', '')::uuid,
      CASE
        WHEN normalized_source_type IN ('inter_ngo_transfer', 'consolidation', 'elimination') THEN supplied_line_ngo
        ELSE _ngo_id
      END,
      NULLIF(line->>'department_id', '')::uuid,
      NULLIF(line->>'dimension_id', '')::uuid,
      NULLIF(line->>'document_id', '')::uuid,
      NULLIF(line->>'grant_application_id', '')::uuid,
      NULLIF(line->>'work_item_id', '')::uuid,
      COALESCE((line->>'line_number')::integer, line_no)
    );
  END LOOP;

  PERFORM public.finance_validate_journal_entity_scope(entry.id);
  PERFORM public.finance_log_audit_event(
    'finance_journal_entry',
    entry.id,
    CASE WHEN _entry_id IS NULL THEN 'created' ELSE 'updated' END,
    jsonb_build_object(
      'line_count', line_no,
      'fiscal_period_id', entry.fiscal_period_id,
      'ngo_id', entry.ngo_id
    )
  );

  RETURN entry;
END;
$$;

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
  IF auth.uid() IS NULL OR NOT public.is_finance_ledger_manager() THEN
    RAISE EXCEPTION 'Finance manager access required to post journal entries';
  END IF;

  SELECT * INTO entry FROM public.finance_journal_entries WHERE id = _entry_id FOR UPDATE;
  IF entry.id IS NULL THEN RAISE EXCEPTION 'Journal entry not found'; END IF;
  IF entry.status NOT IN ('draft', 'pending_approval') THEN
    RAISE EXCEPTION 'Only draft or pending approval entries can be posted. Current status: %', entry.status;
  END IF;

  PERFORM public.finance_validate_journal_entity_scope(entry.id);
  resolved_period_id := public.get_finance_open_fiscal_period(entry.entry_date, entry.fiscal_period_id, entry.ngo_id);

  SELECT COALESCE(
    jsonb_agg(jsonb_build_object(
      'account_id', line.account_id,
      'debit', line.debit,
      'credit', line.credit,
      'memo', line.memo
    ) ORDER BY line.line_number),
    '[]'::jsonb
  ) INTO lines_json
  FROM public.finance_journal_lines line
  WHERE line.journal_entry_id = _entry_id;

  PERFORM public.validate_finance_journal_accounts(lines_json);

  SELECT count(*), COALESCE(sum(debit), 0), COALESCE(sum(credit), 0)
  INTO line_count, total_debit, total_credit
  FROM public.finance_journal_lines
  WHERE journal_entry_id = _entry_id;

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

  PERFORM public.finance_log_audit_event(
    'finance_journal_entry', entry.id, 'posted',
    jsonb_build_object(
      'entry_number', entry.entry_number,
      'total_debit', total_debit,
      'total_credit', total_credit,
      'fiscal_period_id', resolved_period_id,
      'ngo_id', entry.ngo_id
    )
  );
  RETURN entry;
END;
$$;

CREATE OR REPLACE FUNCTION public.reverse_finance_journal_entry(
  _entry_id uuid,
  _reversal_date date DEFAULT CURRENT_DATE,
  _memo text DEFAULT NULL
)
RETURNS public.finance_journal_entries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  original public.finance_journal_entries;
  reversal public.finance_journal_entries;
  reversal_memo text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_finance_ledger_manager() THEN
    RAISE EXCEPTION 'Finance manager access required to reverse journal entries';
  END IF;

  SELECT * INTO original FROM public.finance_journal_entries WHERE id = _entry_id FOR UPDATE;
  IF original.id IS NULL THEN RAISE EXCEPTION 'Journal entry not found'; END IF;
  IF original.status <> 'posted' THEN
    RAISE EXCEPTION 'Only posted journal entries can be reversed. Current status: %', original.status;
  END IF;

  reversal_memo := COALESCE(NULLIF(trim(_memo), ''), 'Reversal of ' || original.entry_number);

  INSERT INTO public.finance_journal_entries (
    entry_date, memo, source_type, source_id, status,
    reversal_of_entry_id, created_by_user_id, ngo_id
  ) VALUES (
    _reversal_date, reversal_memo, 'reversal', original.id, 'draft',
    original.id, auth.uid(), original.ngo_id
  ) RETURNING * INTO reversal;

  INSERT INTO public.finance_journal_lines (
    journal_entry_id, account_id, debit, credit, memo, fund_id, ngo_id,
    department_id, dimension_id, document_id, grant_application_id,
    work_item_id, line_number
  )
  SELECT
    reversal.id, line.account_id, line.credit, line.debit,
    COALESCE(line.memo, reversal_memo), line.fund_id, line.ngo_id,
    line.department_id, line.dimension_id, line.document_id,
    line.grant_application_id, line.work_item_id, line.line_number
  FROM public.finance_journal_lines line
  WHERE line.journal_entry_id = original.id
  ORDER BY line.line_number, line.created_at;

  reversal := public.post_finance_journal_entry(reversal.id);

  UPDATE public.finance_journal_entries
  SET status = 'reversed', updated_at = now()
  WHERE id = original.id;

  PERFORM public.finance_log_audit_event(
    'finance_journal_entry', original.id, 'reversed',
    jsonb_build_object(
      'entry_number', original.entry_number,
      'reversal_entry_id', reversal.id,
      'reversal_entry_number', reversal.entry_number,
      'ngo_id', original.ngo_id
    )
  );
  RETURN reversal;
END;
$$;

-- ---------------------------------------------------------------------------
-- NGO-aware authoritative reports.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.finance_validate_trial_balance(
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
  SELECT jsonb_build_object(
    'total_debit', COALESCE(sum(total_debit), 0),
    'total_credit', COALESCE(sum(total_credit), 0),
    'is_balanced', COALESCE(sum(total_debit), 0) = COALESCE(sum(total_credit), 0),
    'ngo_id', _ngo_id
  )
  FROM public.finance_trial_balance_report(_start_date, _end_date, NULL, _ngo_id, NULL, false);
$$;

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
      CASE
        WHEN account.account_type = 'asset' THEN COALESCE(sum(line.debit - line.credit), 0)
        ELSE COALESCE(sum(line.credit - line.debit), 0)
      END AS balance
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
    WHERE account.account_type IN ('asset', 'liability', 'equity')
    GROUP BY account.id, account.code, account.name, account.account_type, account.financial_statement_line
  ), totals AS (
    SELECT
      COALESCE(sum(balance) FILTER (WHERE account_type = 'asset'), 0) AS total_assets,
      COALESCE(sum(balance) FILTER (WHERE account_type = 'liability'), 0) AS total_liabilities
    FROM balances
  )
  SELECT jsonb_build_object(
    'assets', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('code', code, 'name', name, 'balance', balance) ORDER BY code)
      FROM balances WHERE account_type = 'asset' AND balance <> 0
    ), '[]'::jsonb),
    'liabilities', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('code', code, 'name', name, 'balance', balance) ORDER BY code)
      FROM balances WHERE account_type = 'liability' AND balance <> 0
    ), '[]'::jsonb),
    'net_assets_without_restrictions', COALESCE((
      SELECT sum(balance) FROM balances
      WHERE account_type = 'equity'
        AND financial_statement_line = 'net_assets_without_donor_restrictions'
    ), 0),
    'net_assets_with_restrictions', COALESCE((
      SELECT sum(balance) FROM balances
      WHERE account_type = 'equity'
        AND financial_statement_line = 'net_assets_with_donor_restrictions'
    ), 0),
    'total_assets', totals.total_assets,
    'total_liabilities', totals.total_liabilities,
    'total_net_assets', totals.total_assets - totals.total_liabilities,
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
  )
  SELECT jsonb_build_object(
    'revenue_without_restrictions', COALESCE(sum(amount) FILTER (
      WHERE account_type = 'revenue' AND revenue_restriction_class = 'without_donor_restrictions'
    ), 0),
    'revenue_with_restrictions', COALESCE(sum(amount) FILTER (
      WHERE account_type = 'revenue' AND revenue_restriction_class IN ('with_donor_restrictions', 'grant_restricted')
    ), 0),
    'net_assets_released', COALESCE(sum(amount) FILTER (
      WHERE account_type = 'revenue' AND revenue_restriction_class = 'program_released'
    ), 0),
    'program_expenses', COALESCE(sum(amount) FILTER (
      WHERE account_type = 'expense' AND expense_functional_class = 'program'
    ), 0),
    'management_general_expenses', COALESCE(sum(amount) FILTER (
      WHERE account_type = 'expense' AND expense_functional_class = 'management_general'
    ), 0),
    'fundraising_expenses', COALESCE(sum(amount) FILTER (
      WHERE account_type = 'expense' AND expense_functional_class = 'fundraising'
    ), 0),
    'change_in_net_assets',
      COALESCE(sum(amount) FILTER (WHERE account_type = 'revenue'), 0)
      - COALESCE(sum(amount) FILTER (WHERE account_type = 'expense'), 0),
    'start_date', _start_date,
    'end_date', _end_date,
    'ngo_id', _ngo_id
  ) FROM activity;
$$;

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
BEGIN
  SELECT COALESCE(sum(line.debit - line.credit), 0) INTO beginning_cash
  FROM public.finance_journal_lines line
  JOIN public.finance_journal_entries entry ON entry.id = line.journal_entry_id
  JOIN public.finance_accounts account ON account.id = line.account_id
  WHERE entry.status = 'posted'
    AND entry.entry_date < _start_date
    AND account.is_cash_account = true
    AND (_ngo_id IS NULL OR line.ngo_id = _ngo_id);

  SELECT COALESCE(sum(line.debit - line.credit), 0) INTO ending_cash
  FROM public.finance_journal_lines line
  JOIN public.finance_journal_entries entry ON entry.id = line.journal_entry_id
  JOIN public.finance_accounts account ON account.id = line.account_id
  WHERE entry.status = 'posted'
    AND entry.entry_date <= _end_date
    AND account.is_cash_account = true
    AND (_ngo_id IS NULL OR line.ngo_id = _ngo_id);

  WITH period_lines AS (
    SELECT account.account_type::text AS account_type, account.is_cash_account, line.debit, line.credit
    FROM public.finance_journal_lines line
    JOIN public.finance_journal_entries entry ON entry.id = line.journal_entry_id
    JOIN public.finance_accounts account ON account.id = line.account_id
    WHERE entry.status = 'posted'
      AND entry.entry_date BETWEEN _start_date AND _end_date
      AND (_ngo_id IS NULL OR line.ngo_id = _ngo_id)
  )
  SELECT jsonb_build_object(
    'operating_cash_flow', COALESCE((SELECT sum(credit - debit) FROM period_lines WHERE account_type IN ('revenue', 'expense')), 0),
    'investing_cash_flow', COALESCE((SELECT sum(credit - debit) FROM period_lines WHERE account_type = 'asset' AND is_cash_account = false), 0),
    'financing_cash_flow', COALESCE((SELECT sum(credit - debit) FROM period_lines WHERE account_type IN ('liability', 'equity')), 0),
    'beginning_cash_balance', beginning_cash,
    'ending_cash_balance', ending_cash,
    'start_date', _start_date,
    'end_date', _end_date,
    'ngo_id', _ngo_id
  ) INTO result;

  RETURN result;
END;
$$;

ALTER TABLE public.finance_year_end_packages
  ADD COLUMN IF NOT EXISTS ngo_id uuid REFERENCES public.ngos(id) ON DELETE RESTRICT;

ALTER TABLE public.finance_year_end_packages
  DROP CONSTRAINT IF EXISTS finance_year_end_packages_year_unique;

CREATE UNIQUE INDEX IF NOT EXISTS idx_finance_year_end_packages_scope_unique
  ON public.finance_year_end_packages(
    COALESCE(ngo_id, '00000000-0000-0000-0000-000000000000'::uuid),
    fiscal_year,
    label
  );

CREATE OR REPLACE FUNCTION public.finance_functional_expense_report(
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
  SELECT jsonb_build_object(
    'program', COALESCE(sum(CASE WHEN account.expense_functional_class = 'program' THEN line.debit - line.credit ELSE 0 END), 0),
    'management_general', COALESCE(sum(CASE WHEN account.expense_functional_class = 'management_general' THEN line.debit - line.credit ELSE 0 END), 0),
    'fundraising', COALESCE(sum(CASE WHEN account.expense_functional_class = 'fundraising' THEN line.debit - line.credit ELSE 0 END), 0),
    'pass_through', COALESCE(sum(CASE WHEN account.expense_functional_class = 'pass_through' THEN line.debit - line.credit ELSE 0 END), 0),
    'start_date', _start_date,
    'end_date', _end_date,
    'ngo_id', _ngo_id
  )
  FROM public.finance_journal_lines line
  JOIN public.finance_journal_entries entry ON entry.id = line.journal_entry_id
  JOIN public.finance_accounts account ON account.id = line.account_id
  WHERE entry.status = 'posted'
    AND entry.entry_date BETWEEN _start_date AND _end_date
    AND account.account_type = 'expense'
    AND (_ngo_id IS NULL OR line.ngo_id = _ngo_id);
$$;

CREATE OR REPLACE FUNCTION public.finance_restricted_fund_report(
  _as_of_date date,
  _ngo_id uuid
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'funds', COALESCE(jsonb_agg(jsonb_build_object(
      'fund_id', fund.id,
      'fund_name', fund.name,
      'fund_type', fund.fund_type,
      'ngo_id', fund.ngo_id,
      'balance', balances.balance
    ) ORDER BY fund.name), '[]'::jsonb),
    'as_of_date', _as_of_date,
    'ngo_id', _ngo_id
  )
  FROM (
    SELECT line.fund_id, sum(line.credit - line.debit) AS balance
    FROM public.finance_journal_lines line
    JOIN public.finance_journal_entries entry ON entry.id = line.journal_entry_id
    WHERE entry.status = 'posted'
      AND entry.entry_date <= _as_of_date
      AND line.fund_id IS NOT NULL
      AND (_ngo_id IS NULL OR line.ngo_id = _ngo_id)
    GROUP BY line.fund_id
  ) balances
  JOIN public.finance_funds fund ON fund.id = balances.fund_id;
$$;

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
  package_label text;
  package_data jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_finance_ledger_manager() THEN
    RAISE EXCEPTION 'Finance manager access required';
  END IF;

  SELECT * INTO period_row
  FROM public.finance_fiscal_periods
  WHERE fiscal_year = _fiscal_year
    AND period_type = 'year'
    AND ngo_id IS NOT DISTINCT FROM _ngo_id
  ORDER BY start_date DESC
  LIMIT 1;

  IF period_row.id IS NOT NULL THEN
    year_start := period_row.start_date;
    year_end := period_row.end_date;
  END IF;

  package_label := COALESCE(NULLIF(trim(_label), ''), 'FY' || _fiscal_year::text || ' Audit Package');
  package_data := jsonb_build_object(
    'fiscal_year', _fiscal_year,
    'ngo_id', _ngo_id,
    'trial_balance_validation', public.finance_validate_trial_balance(year_start, year_end, _ngo_id),
    'statement_of_financial_position', public.finance_statement_of_financial_position(year_end, _ngo_id),
    'statement_of_activities', public.finance_statement_of_activities(year_start, year_end, _ngo_id),
    'statement_of_cash_flows', public.finance_statement_of_cash_flows(year_start, year_end, _ngo_id),
    'functional_expense_report', public.finance_functional_expense_report(year_start, year_end, _ngo_id),
    'restricted_fund_report', public.finance_restricted_fund_report(year_end, _ngo_id),
    'generated_at', now()
  );

  UPDATE public.finance_year_end_packages
  SET package_json = package_data,
      fiscal_period_id = period_row.id,
      updated_at = now()
  WHERE fiscal_year = _fiscal_year
    AND label = package_label
    AND ngo_id IS NOT DISTINCT FROM _ngo_id
  RETURNING * INTO package_row;

  IF package_row.id IS NULL THEN
    INSERT INTO public.finance_year_end_packages (
      fiscal_year, ngo_id, label, status, fiscal_period_id,
      package_json, created_by_user_id
    ) VALUES (
      _fiscal_year, _ngo_id, package_label, 'draft', period_row.id,
      package_data, auth.uid()
    ) RETURNING * INTO package_row;
  END IF;

  PERFORM public.finance_log_audit_event(
    'finance_year_end_package', package_row.id, 'generated',
    jsonb_build_object('fiscal_year', _fiscal_year, 'ngo_id', _ngo_id)
  );
  RETURN package_row;
END;
$$;

-- ---------------------------------------------------------------------------
-- Function exposure: authenticated callers only, with authorization inside
-- mutation functions. Internal helpers remain unavailable through the API.
-- ---------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.finance_ensure_fiscal_calendar(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finance_seed_ngo_calendar_on_create() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finance_validate_journal_entity_scope(uuid) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.get_finance_open_fiscal_period(date, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_finance_open_fiscal_period(date, uuid, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.save_finance_journal_entry(uuid, date, text, text, uuid, uuid, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_finance_journal_entry(uuid, date, text, text, uuid, uuid, uuid, jsonb) TO authenticated;

REVOKE ALL ON FUNCTION public.post_finance_journal_entry(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.post_finance_journal_entry(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.reverse_finance_journal_entry(uuid, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reverse_finance_journal_entry(uuid, date, text) TO authenticated;

REVOKE ALL ON FUNCTION public.finance_validate_trial_balance(date, date, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finance_validate_trial_balance(date, date, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.finance_statement_of_financial_position(date, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finance_statement_of_financial_position(date, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.finance_statement_of_activities(date, date, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finance_statement_of_activities(date, date, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.finance_statement_of_cash_flows(date, date, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finance_statement_of_cash_flows(date, date, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.finance_functional_expense_report(date, date, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finance_functional_expense_report(date, date, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.finance_restricted_fund_report(date, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finance_restricted_fund_report(date, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.generate_finance_year_end_package(integer, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_finance_year_end_package(integer, uuid, text) TO authenticated;
