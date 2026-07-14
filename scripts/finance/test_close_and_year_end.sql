-- Transactional smoke test for opening-balance migration, hard period close,
-- immutable year-end packages, and audited reopen controls. All rows roll back.

BEGIN;

DO $test$
DECLARE
  manager_id uuid;
  ngo_id_value uuid;
  january_period public.finance_fiscal_periods;
  month_period public.finance_fiscal_periods;
  year_period public.finance_fiscal_periods;
  asset_account_id uuid;
  equity_account_id uuid;
  opening_entry public.finance_journal_entries;
  draft_entry public.finance_journal_entries;
  readiness jsonb;
  close_row public.finance_year_end_closes;
  unbalanced_rejected boolean := false;
  staged_close_rejected boolean := false;
  draft_close_rejected boolean := false;
  closed_post_rejected boolean := false;
  finalized_reopen_rejected boolean := false;
BEGIN
  SELECT profile.id INTO manager_id
  FROM public.profiles profile
  WHERE profile.role IN ('super_admin', 'admin_pm', 'vp_finance')
  ORDER BY profile.created_at LIMIT 1;
  IF manager_id IS NULL THEN RAISE EXCEPTION 'No Finance manager identity'; END IF;
  PERFORM set_config('request.jwt.claim.sub', manager_id::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

  SELECT id INTO ngo_id_value FROM public.ngos ORDER BY created_at LIMIT 1;
  IF ngo_id_value IS NULL THEN RAISE EXCEPTION 'No NGO available for close test'; END IF;
  PERFORM public.finance_ensure_fiscal_calendar(ngo_id_value, 2025);

  SELECT * INTO january_period
  FROM public.finance_fiscal_periods
  WHERE ngo_id = ngo_id_value AND fiscal_year = 2025
    AND period_type = 'month' AND period_number = 1;
  SELECT id INTO asset_account_id FROM public.finance_accounts WHERE code = '1000' AND is_active;
  SELECT id INTO equity_account_id FROM public.finance_accounts WHERE code = '3000' AND is_active;
  IF january_period.id IS NULL OR asset_account_id IS NULL OR equity_account_id IS NULL THEN
    RAISE EXCEPTION 'Required fiscal period or standard accounts are missing';
  END IF;

  BEGIN
    PERFORM public.import_finance_opening_balances(
      january_period.id, ngo_id_value,
      jsonb_build_array(
        jsonb_build_object('account_code', '1000', 'debit', '1000', 'credit', ''),
        jsonb_build_object('account_code', '3000', 'debit', '', 'credit', '900')
      )
    );
  EXCEPTION WHEN OTHERS THEN
    unbalanced_rejected := position('out of balance' in lower(SQLERRM)) > 0;
  END;
  IF NOT unbalanced_rejected THEN RAISE EXCEPTION 'Unbalanced opening import was accepted'; END IF;

  PERFORM public.import_finance_opening_balances_with_source(
    january_period.id, ngo_id_value,
    jsonb_build_array(
      jsonb_build_object('account_code', '1000', 'debit', '1000', 'credit', '', 'memo', 'Imported cash'),
      jsonb_build_object('account_code', '3000', 'debit', '', 'credit', '1000', 'memo', 'Imported net assets')
    ),
    'internal/finance/opening-balances/' || ngo_id_value::text || '/' || january_period.id::text || '/smoke.csv',
    'smoke.csv', 128, repeat('c', 64)
  );

  readiness := public.finance_period_close_readiness(january_period.id);
  IF (readiness->>'is_ready')::boolean OR (readiness->>'staged_opening_balances')::integer <> 2 THEN
    RAISE EXCEPTION 'Staged opening balances did not block close';
  END IF;
  BEGIN
    PERFORM public.close_finance_fiscal_period(january_period.id);
  EXCEPTION WHEN OTHERS THEN
    staged_close_rejected := position('not ready' in lower(SQLERRM)) > 0;
  END;
  IF NOT staged_close_rejected THEN RAISE EXCEPTION 'Period closed with unposted opening balances'; END IF;

  opening_entry := public.post_finance_opening_balances(january_period.id);
  IF opening_entry.status <> 'posted' OR opening_entry.source_type <> 'finance_opening_balance' THEN
    RAISE EXCEPTION 'Opening balances did not become a posted journal';
  END IF;
  IF NOT (public.finance_validate_trial_balance('2025-01-01', '2025-01-31', ngo_id_value)->>'is_balanced')::boolean THEN
    RAISE EXCEPTION 'Opening balance journal is not balanced';
  END IF;

  INSERT INTO public.finance_journal_entries (
    entry_date, memo, source_type, status, created_by_user_id, ngo_id
  ) VALUES (
    '2025-01-15', 'Unresolved close test', 'close_smoke', 'draft', manager_id, ngo_id_value
  ) RETURNING * INTO draft_entry;
  readiness := public.finance_period_close_readiness(january_period.id);
  IF (readiness->>'pending_journals')::integer <> 1 THEN
    RAISE EXCEPTION 'Draft journal did not appear in close readiness';
  END IF;
  BEGIN
    PERFORM public.close_finance_fiscal_period(january_period.id);
  EXCEPTION WHEN OTHERS THEN
    draft_close_rejected := position('not ready' in lower(SQLERRM)) > 0;
  END;
  IF NOT draft_close_rejected THEN RAISE EXCEPTION 'Period closed with a draft journal'; END IF;
  DELETE FROM public.finance_journal_entries WHERE id = draft_entry.id;

  january_period := public.close_finance_fiscal_period(january_period.id);
  january_period := public.lock_finance_fiscal_period(january_period.id);
  IF january_period.status <> 'locked' OR january_period.close_readiness_snapshot IS NULL THEN
    RAISE EXCEPTION 'Period close evidence was not retained';
  END IF;

  INSERT INTO public.finance_journal_entries (
    entry_date, memo, source_type, status, created_by_user_id, ngo_id
  ) VALUES (
    '2025-01-20', 'Closed period post test', 'close_smoke', 'draft', manager_id, ngo_id_value
  ) RETURNING * INTO draft_entry;
  INSERT INTO public.finance_journal_lines (
    journal_entry_id, account_id, debit, credit, memo, ngo_id, line_number
  ) VALUES
    (draft_entry.id, asset_account_id, 10, 0, 'Closed post test', ngo_id_value, 1),
    (draft_entry.id, equity_account_id, 0, 10, 'Closed post test', ngo_id_value, 2);
  BEGIN
    PERFORM public.post_finance_journal_entry(draft_entry.id);
  EXCEPTION WHEN OTHERS THEN
    closed_post_rejected := position('closed or locked' in lower(SQLERRM)) > 0
      OR position('no open monthly' in lower(SQLERRM)) > 0;
  END;
  IF NOT closed_post_rejected THEN RAISE EXCEPTION 'Posting into a locked period was accepted'; END IF;
  DELETE FROM public.finance_journal_lines WHERE journal_entry_id = draft_entry.id;
  DELETE FROM public.finance_journal_entries WHERE id = draft_entry.id;

  january_period := public.reopen_finance_fiscal_period(january_period.id, 'Smoke-test controlled reopen');
  january_period := public.close_finance_fiscal_period(january_period.id);

  FOR month_period IN
    SELECT * FROM public.finance_fiscal_periods
    WHERE ngo_id = ngo_id_value AND fiscal_year = 2025 AND period_type = 'month'
      AND period_number > 1
    ORDER BY period_number
  LOOP
    PERFORM public.close_finance_fiscal_period(month_period.id);
  END LOOP;

  readiness := public.finance_year_end_close_readiness(2025, ngo_id_value);
  IF NOT (readiness->>'is_ready')::boolean THEN
    RAISE EXCEPTION 'Clean fiscal year was not ready: %', readiness->'blockers';
  END IF;
  close_row := public.finalize_finance_year_end(2025, ngo_id_value);
  IF close_row.status <> 'finalized' THEN RAISE EXCEPTION 'Fiscal year did not finalize'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.finance_year_end_packages
    WHERE id = close_row.package_id AND status = 'locked' AND package_json ? 'close_readiness'
  ) THEN RAISE EXCEPTION 'Immutable year-end package was not created'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.finance_fiscal_periods
    WHERE ngo_id = ngo_id_value AND fiscal_year = 2025 AND status <> 'locked'
  ) THEN RAISE EXCEPTION 'Year-end finalization did not lock every fiscal period'; END IF;

  SELECT * INTO year_period FROM public.finance_fiscal_periods
  WHERE ngo_id = ngo_id_value AND fiscal_year = 2025 AND period_type = 'year';
  BEGIN
    PERFORM public.reopen_finance_fiscal_period(year_period.id, 'Should require year reopen first');
  EXCEPTION WHEN OTHERS THEN
    finalized_reopen_rejected := position('reopen the finalized fiscal year' in lower(SQLERRM)) > 0;
  END;
  IF NOT finalized_reopen_rejected THEN
    RAISE EXCEPTION 'Individual period reopened while fiscal year was finalized';
  END IF;

  close_row := public.reopen_finance_year_end(2025, ngo_id_value, 'Auditor-requested adjustment test');
  IF close_row.status <> 'reopened' THEN RAISE EXCEPTION 'Fiscal year reopen was not recorded'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.finance_year_end_packages
    WHERE id = close_row.package_id AND status = 'locked'
  ) THEN RAISE EXCEPTION 'Prior year-end package was modified during reopen'; END IF;
END;
$test$;

ROLLBACK;

SELECT 'finance_close_and_year_end' AS verification, 'pass' AS result;
