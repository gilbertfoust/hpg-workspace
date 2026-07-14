-- Phase 13: Give every NGO a living chart of accounts while retaining one canonical
-- organization-wide account definition. Budgets may activate an existing
-- account or create a canonical account and activate it for the selected NGO.

CREATE TABLE public.finance_ngo_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ngo_id uuid NOT NULL REFERENCES public.ngos(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.finance_accounts(id) ON DELETE RESTRICT,
  local_code text,
  local_name text,
  is_active boolean NOT NULL DEFAULT true,
  activation_source_type text NOT NULL DEFAULT 'manual',
  activation_source_id uuid,
  activated_at timestamptz NOT NULL DEFAULT now(),
  activated_by_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  deactivated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT finance_ngo_accounts_unique UNIQUE (ngo_id, account_id),
  CONSTRAINT finance_ngo_accounts_local_code_not_blank CHECK (local_code IS NULL OR trim(local_code) <> ''),
  CONSTRAINT finance_ngo_accounts_local_name_not_blank CHECK (local_name IS NULL OR trim(local_name) <> '')
);

CREATE INDEX idx_finance_ngo_accounts_account
  ON public.finance_ngo_accounts(account_id, ngo_id);
CREATE INDEX idx_finance_ngo_accounts_active
  ON public.finance_ngo_accounts(ngo_id, is_active, account_id);

CREATE TRIGGER trg_finance_ngo_accounts_updated_at
  BEFORE UPDATE ON public.finance_ngo_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.finance_ngo_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "finance ngo accounts read"
  ON public.finance_ngo_accounts FOR SELECT TO authenticated
  USING (public.can_read_finance_ledger());

CREATE POLICY "finance ngo accounts manage"
  ON public.finance_ngo_accounts FOR ALL TO authenticated
  USING (public.is_finance_ledger_manager())
  WITH CHECK (public.is_finance_ledger_manager());

GRANT SELECT ON public.finance_ngo_accounts TO authenticated;

CREATE OR REPLACE FUNCTION public.finance_upsert_ngo_account_activation(
  _ngo_id uuid,
  _account_id uuid,
  _source_type text DEFAULT 'journal',
  _source_id uuid DEFAULT NULL
)
RETURNS public.finance_ngo_accounts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE activation public.finance_ngo_accounts;
BEGIN
  IF _ngo_id IS NULL OR _account_id IS NULL THEN
    RAISE EXCEPTION 'NGO and account are required for account activation';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ngos WHERE id = _ngo_id) THEN
    RAISE EXCEPTION 'Selected NGO does not exist';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.finance_accounts WHERE id = _account_id) THEN
    RAISE EXCEPTION 'Finance account does not exist';
  END IF;

  INSERT INTO public.finance_ngo_accounts (
    ngo_id, account_id, is_active, activation_source_type,
    activation_source_id, activated_at, activated_by_user_id,
    deactivated_at
  ) VALUES (
    _ngo_id, _account_id, true,
    COALESCE(NULLIF(trim(_source_type), ''), 'journal'),
    _source_id, now(), auth.uid(), NULL
  )
  ON CONFLICT (ngo_id, account_id) DO UPDATE
  SET is_active = true,
      activation_source_type = EXCLUDED.activation_source_type,
      activation_source_id = COALESCE(EXCLUDED.activation_source_id, public.finance_ngo_accounts.activation_source_id),
      activated_at = CASE WHEN public.finance_ngo_accounts.is_active THEN public.finance_ngo_accounts.activated_at ELSE now() END,
      activated_by_user_id = COALESCE(auth.uid(), public.finance_ngo_accounts.activated_by_user_id),
      deactivated_at = NULL,
      updated_at = now()
  RETURNING * INTO activation;

  RETURN activation;
END;
$$;

REVOKE ALL ON FUNCTION public.finance_upsert_ngo_account_activation(uuid, uuid, text, uuid)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.ensure_finance_ngo_account(
  _ngo_id uuid,
  _account_id uuid DEFAULT NULL,
  _account_spec jsonb DEFAULT '{}'::jsonb,
  _source_type text DEFAULT 'manual',
  _source_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  account_row public.finance_accounts;
  requested_type public.finance_account_type;
  requested_normal public.finance_normal_balance;
  requested_code text;
  requested_name text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_finance_staff() THEN
    RAISE EXCEPTION 'Finance staff access required';
  END IF;
  IF _ngo_id IS NULL THEN RAISE EXCEPTION 'Select an NGO before using an account'; END IF;

  IF _account_id IS NOT NULL THEN
    SELECT * INTO account_row FROM public.finance_accounts WHERE id = _account_id FOR UPDATE;
    IF account_row.id IS NULL THEN RAISE EXCEPTION 'Finance account not found'; END IF;
  ELSE
    requested_code := NULLIF(trim(_account_spec->>'code'), '');
    requested_name := NULLIF(trim(_account_spec->>'name'), '');
    IF requested_code IS NULL OR requested_name IS NULL OR NULLIF(_account_spec->>'account_type', '') IS NULL THEN
      RAISE EXCEPTION 'New budget accounts require code, name, and account type';
    END IF;

    requested_type := (_account_spec->>'account_type')::public.finance_account_type;
    requested_normal := COALESCE(
      NULLIF(_account_spec->>'normal_balance', '')::public.finance_normal_balance,
      CASE WHEN requested_type IN ('asset', 'expense')
        THEN 'debit'::public.finance_normal_balance
        ELSE 'credit'::public.finance_normal_balance END
    );

    SELECT * INTO account_row
    FROM public.finance_accounts
    WHERE code = requested_code
    FOR UPDATE;

    IF account_row.id IS NOT NULL THEN
      IF account_row.account_type <> requested_type THEN
        RAISE EXCEPTION 'Account code % already exists as %, not %',
          requested_code, account_row.account_type, requested_type;
      END IF;
      UPDATE public.finance_accounts
      SET is_active = true, updated_at = now()
      WHERE id = account_row.id
      RETURNING * INTO account_row;
    ELSE
      INSERT INTO public.finance_accounts (
        code, name, account_type, account_subtype, normal_balance,
        parent_account_id, is_active, entity_scope,
        revenue_restriction_class, expense_functional_class,
        form_990_line, financial_statement_line
      ) VALUES (
        requested_code,
        requested_name,
        requested_type,
        NULLIF(trim(_account_spec->>'account_subtype'), ''),
        requested_normal,
        NULLIF(_account_spec->>'parent_account_id', '')::uuid,
        true,
        COALESCE(NULLIF(_account_spec->>'entity_scope', ''), 'fiscal_sponsorship'),
        NULLIF(_account_spec->>'revenue_restriction_class', ''),
        NULLIF(_account_spec->>'expense_functional_class', ''),
        NULLIF(trim(_account_spec->>'form_990_line'), ''),
        NULLIF(trim(_account_spec->>'financial_statement_line'), '')
      ) RETURNING * INTO account_row;
    END IF;
  END IF;

  PERFORM public.finance_upsert_ngo_account_activation(
    _ngo_id, account_row.id, _source_type, _source_id
  );
  PERFORM public.finance_log_audit_event(
    'finance_account', account_row.id, 'ngo_account_activated',
    jsonb_build_object('ngo_id', _ngo_id, 'source_type', _source_type, 'source_id', _source_id)
  );
  RETURN account_row.id;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_finance_ngo_account(uuid, uuid, jsonb, text, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_finance_ngo_account(uuid, uuid, jsonb, text, uuid)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.finance_ngo_account_catalog(
  _ngo_id uuid,
  _include_inactive boolean DEFAULT false
)
RETURNS TABLE (
  id uuid,
  code text,
  name text,
  account_type public.finance_account_type,
  account_subtype text,
  parent_account_id uuid,
  normal_balance public.finance_normal_balance,
  is_active boolean,
  is_cash_account boolean,
  entity_scope text,
  revenue_restriction_class text,
  expense_functional_class text,
  form_990_line text,
  financial_statement_line text,
  activation_source_type text,
  activated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT account.id,
         COALESCE(NULLIF(link.local_code, ''), account.code),
         COALESCE(NULLIF(link.local_name, ''), account.name),
         account.account_type, account.account_subtype, account.parent_account_id,
         account.normal_balance, (account.is_active AND link.is_active),
         account.is_cash_account, account.entity_scope,
         account.revenue_restriction_class, account.expense_functional_class,
         account.form_990_line, account.financial_statement_line,
         link.activation_source_type, link.activated_at
  FROM public.finance_ngo_accounts link
  JOIN public.finance_accounts account ON account.id = link.account_id
  WHERE link.ngo_id = _ngo_id
    AND (_include_inactive OR (link.is_active AND account.is_active))
    AND public.can_read_finance_ledger()
  ORDER BY account.code;
$$;

REVOKE ALL ON FUNCTION public.finance_ngo_account_catalog(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finance_ngo_account_catalog(uuid, boolean) TO authenticated;

-- Existing economic activity becomes the initial NGO account activation map.
INSERT INTO public.finance_ngo_accounts (
  ngo_id, account_id, activation_source_type, activation_source_id, activated_by_user_id
)
SELECT DISTINCT line.ngo_id, line.account_id, 'journal', line.journal_entry_id, entry.created_by_user_id
FROM public.finance_journal_lines line
JOIN public.finance_journal_entries entry ON entry.id = line.journal_entry_id
WHERE line.ngo_id IS NOT NULL
ON CONFLICT (ngo_id, account_id) DO NOTHING;

INSERT INTO public.finance_ngo_accounts (
  ngo_id, account_id, activation_source_type, activation_source_id, activated_by_user_id
)
SELECT DISTINCT budget.ngo_id, line.account_id, 'budget', budget.id, budget.created_by_user_id
FROM public.finance_budget_lines line
JOIN public.finance_budgets budget ON budget.id = line.budget_id
WHERE budget.ngo_id IS NOT NULL
ON CONFLICT (ngo_id, account_id) DO NOTHING;

INSERT INTO public.finance_ngo_accounts (
  ngo_id, account_id, activation_source_type, activation_source_id
)
SELECT DISTINCT bank.ngo_id, bank.linked_finance_account_id, 'bank_account', bank.id
FROM public.finance_bank_accounts bank
WHERE bank.ngo_id IS NOT NULL
ON CONFLICT (ngo_id, account_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.finance_sync_journal_line_ngo_account()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.ngo_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.finance_journal_entries entry
    WHERE entry.id = NEW.journal_entry_id AND entry.status = 'posted'
  ) THEN
    PERFORM public.finance_upsert_ngo_account_activation(
      NEW.ngo_id, NEW.account_id, 'journal', NEW.journal_entry_id
    );
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.finance_sync_journal_line_ngo_account() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_finance_sync_journal_line_ngo_account
  AFTER INSERT OR UPDATE OF account_id, ngo_id ON public.finance_journal_lines
  FOR EACH ROW EXECUTE FUNCTION public.finance_sync_journal_line_ngo_account();

CREATE OR REPLACE FUNCTION public.finance_sync_posted_journal_ngo_accounts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'posted' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO public.finance_ngo_accounts (
      ngo_id, account_id, activation_source_type, activation_source_id,
      activated_at, activated_by_user_id
    )
    SELECT DISTINCT line.ngo_id, line.account_id, 'journal', NEW.id, now(), NEW.created_by_user_id
    FROM public.finance_journal_lines line
    WHERE line.journal_entry_id = NEW.id AND line.ngo_id IS NOT NULL
    ON CONFLICT (ngo_id, account_id) DO UPDATE
    SET is_active = true, activation_source_type = 'journal',
        activation_source_id = EXCLUDED.activation_source_id,
        deactivated_at = NULL, updated_at = now();
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.finance_sync_posted_journal_ngo_accounts() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_finance_sync_posted_journal_ngo_accounts
  AFTER INSERT OR UPDATE OF status ON public.finance_journal_entries
  FOR EACH ROW EXECUTE FUNCTION public.finance_sync_posted_journal_ngo_accounts();

-- Budgets are NGO-specific economic plans. A budget line may reference an
-- existing account_id or supply a new account definition. Repeated entries for
-- the same account/month add together instead of creating a disconnected row.
CREATE OR REPLACE FUNCTION public.save_finance_budget(
  _budget_id uuid DEFAULT NULL,
  _header jsonb DEFAULT '{}'::jsonb,
  _lines jsonb DEFAULT NULL
)
RETURNS public.finance_budgets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  budget public.finance_budgets;
  line jsonb;
  resolved_account_id uuid;
  selected_ngo_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_finance_staff() THEN RAISE EXCEPTION 'Finance staff access required'; END IF;
  IF _lines IS NOT NULL AND jsonb_typeof(_lines) <> 'array' THEN RAISE EXCEPTION 'Budget lines must be a JSON array'; END IF;

  IF _budget_id IS NULL THEN
    selected_ngo_id := NULLIF(_header->>'ngo_id', '')::uuid;
    IF selected_ngo_id IS NULL THEN RAISE EXCEPTION 'Select an NGO before creating its operating budget'; END IF;
    IF NULLIF(trim(_header->>'name'), '') IS NULL OR NULLIF(_header->>'fiscal_year', '') IS NULL THEN
      RAISE EXCEPTION 'Budget name and fiscal year are required';
    END IF;

    INSERT INTO public.finance_budgets (
      name, fiscal_year, scope_type, department_id, ngo_id, fund_id,
      grant_application_id, status, memo, created_by_user_id
    ) VALUES (
      trim(_header->>'name'), (_header->>'fiscal_year')::integer,
      'ngo', NULLIF(_header->>'department_id', '')::uuid, selected_ngo_id,
      NULLIF(_header->>'fund_id', '')::uuid,
      NULLIF(_header->>'grant_application_id', '')::uuid,
      'draft', NULLIF(trim(_header->>'memo'), ''), auth.uid()
    ) RETURNING * INTO budget;
  ELSE
    SELECT * INTO budget FROM public.finance_budgets WHERE id = _budget_id FOR UPDATE;
    IF budget.id IS NULL THEN RAISE EXCEPTION 'Budget not found'; END IF;
    IF budget.status NOT IN ('draft', 'rejected') THEN RAISE EXCEPTION 'Only draft or rejected budgets can be edited'; END IF;
    IF budget.ngo_id IS NULL THEN RAISE EXCEPTION 'This budget must be assigned to an NGO before editing'; END IF;

    UPDATE public.finance_budgets
    SET name = COALESCE(NULLIF(trim(_header->>'name'), ''), budget.name),
        fiscal_year = COALESCE(NULLIF(_header->>'fiscal_year', '')::integer, budget.fiscal_year),
        department_id = CASE WHEN _header ? 'department_id' THEN NULLIF(_header->>'department_id', '')::uuid ELSE budget.department_id END,
        fund_id = CASE WHEN _header ? 'fund_id' THEN NULLIF(_header->>'fund_id', '')::uuid ELSE budget.fund_id END,
        grant_application_id = CASE WHEN _header ? 'grant_application_id' THEN NULLIF(_header->>'grant_application_id', '')::uuid ELSE budget.grant_application_id END,
        memo = CASE WHEN _header ? 'memo' THEN NULLIF(trim(_header->>'memo'), '') ELSE budget.memo END,
        status = 'draft', rejected_reason = NULL,
        reviewed_by_user_id = NULL, reviewed_at = NULL
    WHERE id = budget.id
    RETURNING * INTO budget;
  END IF;

  IF _lines IS NOT NULL THEN
    DELETE FROM public.finance_budget_lines WHERE budget_id = budget.id;
    FOR line IN SELECT value FROM jsonb_array_elements(_lines) LOOP
      resolved_account_id := public.ensure_finance_ngo_account(
        budget.ngo_id,
        NULLIF(line->>'account_id', '')::uuid,
        jsonb_build_object(
          'code', line->>'account_code',
          'name', line->>'account_name',
          'account_type', line->>'account_type',
          'account_subtype', line->>'account_subtype',
          'normal_balance', line->>'normal_balance',
          'parent_account_id', line->>'parent_account_id',
          'entity_scope', COALESCE(line->>'entity_scope', 'fiscal_sponsorship'),
          'revenue_restriction_class', line->>'revenue_restriction_class',
          'expense_functional_class', line->>'expense_functional_class',
          'form_990_line', line->>'form_990_line',
          'financial_statement_line', line->>'financial_statement_line'
        ),
        'budget', budget.id
      );

      INSERT INTO public.finance_budget_lines (
        budget_id, account_id, period_month, amount, memo
      ) VALUES (
        budget.id, resolved_account_id, (line->>'period_month')::integer,
        round(COALESCE((line->>'amount')::numeric, 0), 2),
        NULLIF(trim(line->>'memo'), '')
      )
      ON CONFLICT (budget_id, account_id, period_month) DO UPDATE
      SET amount = public.finance_budget_lines.amount + EXCLUDED.amount,
          memo = COALESCE(EXCLUDED.memo, public.finance_budget_lines.memo),
          updated_at = now();
    END LOOP;
  END IF;

  PERFORM public.finance_log_audit_event(
    'budget', budget.id,
    CASE WHEN _budget_id IS NULL THEN 'created' ELSE 'updated' END,
    jsonb_build_object('name', budget.name, 'fiscal_year', budget.fiscal_year, 'ngo_id', budget.ngo_id)
  );
  RETURN budget;
END;
$$;

REVOKE ALL ON FUNCTION public.save_finance_budget(uuid, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_finance_budget(uuid, jsonb, jsonb) TO authenticated;

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
  WITH selected_budget AS (
    SELECT * FROM public.finance_budgets
    WHERE id = _budget_id AND public.can_read_finance_ledger()
  ),
  budget_amounts AS (
    SELECT line.account_id, sum(line.amount) AS budget_amount
    FROM public.finance_budget_lines line
    JOIN selected_budget budget ON budget.id = line.budget_id
    GROUP BY line.account_id
  ),
  actuals AS (
    SELECT line.account_id,
      sum(CASE WHEN account.normal_balance = 'debit'
        THEN line.debit - line.credit ELSE line.credit - line.debit END) AS actual_amount
    FROM public.finance_journal_lines line
    JOIN public.finance_journal_entries entry ON entry.id = line.journal_entry_id
    JOIN public.finance_accounts account ON account.id = line.account_id
    JOIN selected_budget budget ON true
    WHERE entry.status = 'posted'
      AND entry.ngo_id IS NOT DISTINCT FROM budget.ngo_id
      AND line.ngo_id IS NOT DISTINCT FROM budget.ngo_id
      AND line.account_id IN (SELECT account_id FROM budget_amounts)
      AND entry.entry_date >= COALESCE(_start_date, make_date(budget.fiscal_year, 1, 1))
      AND entry.entry_date <= COALESCE(_end_date, make_date(budget.fiscal_year, 12, 31))
    GROUP BY line.account_id
  )
  SELECT account.id, account.code, account.name,
    round(COALESCE(amounts.budget_amount, 0), 2),
    round(COALESCE(actuals.actual_amount, 0), 2),
    round(COALESCE(amounts.budget_amount, 0) - COALESCE(actuals.actual_amount, 0), 2),
    CASE WHEN COALESCE(amounts.budget_amount, 0) = 0 THEN NULL
      ELSE round((COALESCE(actuals.actual_amount, 0) / amounts.budget_amount) * 100, 2) END
  FROM budget_amounts amounts
  JOIN public.finance_accounts account ON account.id = amounts.account_id
  LEFT JOIN actuals ON actuals.account_id = amounts.account_id
  ORDER BY account.code;
$$;

REVOKE ALL ON FUNCTION public.finance_budget_vs_actual_report(uuid, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finance_budget_vs_actual_report(uuid, date, date) TO authenticated;
