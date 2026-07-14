-- Transactional production/staging smoke test for NGO-scoped statement matching.
-- All test records are rolled back.

BEGIN;

DO $test$
DECLARE
  manager_id uuid;
  ngo_id_value uuid;
  other_ngo_id uuid;
  bank_gl_id uuid;
  expense_id uuid;
  revenue_id uuid;
  bank_register public.finance_bank_accounts;
  expense_payment public.finance_payments;
  deposit_entry public.finance_journal_entries;
  small_deposit_entry public.finance_journal_entries;
  cross_entry public.finance_journal_entries;
  cross_line_id uuid;
  small_line_id uuid;
  import_result jsonb;
  import_id_value uuid;
  suggested_count integer;
  statement_tx public.finance_bank_statement_transactions;
  reconciliation public.finance_bank_reconciliations;
  cross_rejected boolean := false;
  nonzero_close_rejected boolean := false;
  sample_item_id uuid;
BEGIN
  SELECT profile.id INTO manager_id
  FROM public.profiles profile
  WHERE profile.role IN ('super_admin', 'admin_pm', 'vp_finance')
  ORDER BY profile.created_at LIMIT 1;
  IF manager_id IS NULL THEN RAISE EXCEPTION 'No Finance manager identity'; END IF;
  PERFORM set_config('request.jwt.claim.sub', manager_id::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

  SELECT id INTO ngo_id_value FROM public.ngos ORDER BY created_at LIMIT 1;
  SELECT id INTO other_ngo_id FROM public.ngos WHERE id <> ngo_id_value ORDER BY created_at LIMIT 1;
  SELECT id INTO bank_gl_id FROM public.finance_accounts WHERE code = '1000';
  SELECT id INTO expense_id FROM public.finance_accounts WHERE code = '5500';
  SELECT id INTO revenue_id FROM public.finance_accounts WHERE code = '4000';

  INSERT INTO public.finance_bank_accounts (
    ngo_id, account_kind, account_name, institution_name, last_four,
    linked_finance_account_id, opening_balance, opening_balance_date
  ) VALUES (
    ngo_id_value, 'bank', 'Statement Smoke Checking', 'Test Bank', '4242',
    bank_gl_id, 1000, CURRENT_DATE - 30
  ) RETURNING * INTO bank_register;

  expense_payment := public.create_and_post_finance_expense_transaction(
    ngo_id_value, expense_id, bank_gl_id, 'ach', CURRENT_DATE, 50,
    'Statement Smoke Vendor', 'Statement withdrawal', 'BANK-WITHDRAWAL',
    NULL, NULL, NULL, NULL, NULL, NULL
  );

  INSERT INTO public.finance_journal_entries (
    entry_date, memo, source_type, status, created_by_user_id, ngo_id
  ) VALUES (
    CURRENT_DATE, 'Statement deposit', 'bank_statement_smoke', 'draft', manager_id, ngo_id_value
  ) RETURNING * INTO deposit_entry;
  INSERT INTO public.finance_journal_lines (
    journal_entry_id, account_id, debit, credit, memo, ngo_id, line_number
  ) VALUES
    (deposit_entry.id, bank_gl_id, 100, 0, 'Statement deposit', ngo_id_value, 1),
    (deposit_entry.id, revenue_id, 0, 100, 'Statement deposit offset', ngo_id_value, 2);
  deposit_entry := public.post_finance_journal_entry(deposit_entry.id);

  -- Deliberate same-amount false candidate under another NGO.
  INSERT INTO public.finance_journal_entries (
    entry_date, memo, source_type, status, created_by_user_id, ngo_id
  ) VALUES (
    CURRENT_DATE, 'Cross NGO false candidate', 'bank_statement_smoke', 'draft', manager_id, other_ngo_id
  ) RETURNING * INTO cross_entry;
  INSERT INTO public.finance_journal_lines (
    journal_entry_id, account_id, debit, credit, memo, ngo_id, line_number
  ) VALUES
    (cross_entry.id, bank_gl_id, 25, 0, 'Cross NGO false candidate', other_ngo_id, 1),
    (cross_entry.id, revenue_id, 0, 25, 'Cross NGO offset', other_ngo_id, 2);
  cross_entry := public.post_finance_journal_entry(cross_entry.id);
  SELECT id INTO cross_line_id FROM public.finance_journal_lines
  WHERE journal_entry_id = cross_entry.id AND account_id = bank_gl_id LIMIT 1;

  import_result := public.import_finance_bank_statement(
    ngo_id_value, bank_register.id, CURRENT_DATE, CURRENT_DATE, 1000, 1075,
    'internal/finance/bank-statements/' || ngo_id_value::text || '/' || bank_register.id::text || '/smoke.csv',
    'smoke.csv', 'text/csv', 512, repeat('b', 64),
    jsonb_build_array(
      jsonb_build_object('transaction_date', CURRENT_DATE::text, 'description', 'Statement deposit', 'amount', 100, 'currency', 'USD', 'source_transaction_id', 'DEP-100'),
      jsonb_build_object('transaction_date', CURRENT_DATE::text, 'description', 'Statement withdrawal', 'amount', -50, 'currency', 'USD', 'source_transaction_id', 'WD-50'),
      jsonb_build_object('transaction_date', CURRENT_DATE::text, 'description', 'Small deposit', 'amount', 25, 'currency', 'USD', 'source_transaction_id', 'DEP-25')
    )
  );
  import_id_value := (import_result->'import'->>'id')::uuid;
  IF import_id_value IS NULL OR (import_result->>'is_duplicate')::boolean THEN
    RAISE EXCEPTION 'Statement import failed';
  END IF;
  IF (import_result->'import'->>'statement_variance')::numeric <> 0 THEN
    RAISE EXCEPTION 'Statement did not tie';
  END IF;

  suggested_count := public.suggest_finance_bank_statement_matches(import_id_value);
  IF suggested_count <> 2 THEN
    RAISE EXCEPTION 'Expected two same-NGO suggestions, got %', suggested_count;
  END IF;
  FOR statement_tx IN
    SELECT * FROM public.finance_bank_statement_transactions
    WHERE import_id = import_id_value AND match_status = 'suggested'
  LOOP
    PERFORM public.confirm_finance_bank_statement_match(statement_tx.id, NULL);
  END LOOP;

  SELECT * INTO statement_tx FROM public.finance_bank_statement_transactions
  WHERE import_id = import_id_value AND source_transaction_id = 'DEP-25' LIMIT 1;
  BEGIN
    PERFORM public.confirm_finance_bank_statement_match(statement_tx.id, cross_line_id);
  EXCEPTION WHEN OTHERS THEN
    cross_rejected := position('outside this NGO' in SQLERRM) > 0;
  END;
  IF NOT cross_rejected THEN RAISE EXCEPTION 'Cross-NGO match was not rejected'; END IF;

  INSERT INTO public.finance_journal_entries (
    entry_date, memo, source_type, status, created_by_user_id, ngo_id
  ) VALUES (
    CURRENT_DATE, 'Small deposit', 'bank_statement_smoke', 'draft', manager_id, ngo_id_value
  ) RETURNING * INTO small_deposit_entry;
  INSERT INTO public.finance_journal_lines (
    journal_entry_id, account_id, debit, credit, memo, ngo_id, line_number
  ) VALUES
    (small_deposit_entry.id, bank_gl_id, 25, 0, 'Small deposit', ngo_id_value, 1),
    (small_deposit_entry.id, revenue_id, 0, 25, 'Small deposit offset', ngo_id_value, 2);
  small_deposit_entry := public.post_finance_journal_entry(small_deposit_entry.id);
  SELECT id INTO small_line_id FROM public.finance_journal_lines
  WHERE journal_entry_id = small_deposit_entry.id AND account_id = bank_gl_id LIMIT 1;
  PERFORM public.confirm_finance_bank_statement_match(statement_tx.id, small_line_id);

  reconciliation := public.start_finance_bank_reconciliation(
    ngo_id_value, bank_register.id, CURRENT_DATE, CURRENT_DATE, 1000, 1075, import_id_value
  );
  IF reconciliation.difference <> 0 THEN RAISE EXCEPTION 'Reconciliation did not start at zero'; END IF;
  IF (
    SELECT count(*) FROM public.finance_bank_reconciliation_items
    WHERE reconciliation_id = reconciliation.id AND is_cleared AND statement_transaction_id IS NOT NULL
  ) <> 3 THEN RAISE EXCEPTION 'Statement evidence missing from reconciliation'; END IF;

  SELECT id INTO sample_item_id FROM public.finance_bank_reconciliation_items
  WHERE reconciliation_id = reconciliation.id AND is_cleared LIMIT 1;
  UPDATE public.finance_bank_reconciliation_items SET is_cleared = false WHERE id = sample_item_id;
  BEGIN
    PERFORM public.finalize_finance_bank_reconciliation(reconciliation.id, 'Should not close');
  EXCEPTION WHEN OTHERS THEN
    nonzero_close_rejected := position('difference must be zero' in lower(SQLERRM)) > 0;
  END;
  IF NOT nonzero_close_rejected THEN RAISE EXCEPTION 'Nonzero reconciliation was allowed to finalize'; END IF;
  UPDATE public.finance_bank_reconciliation_items SET is_cleared = true WHERE id = sample_item_id;

  reconciliation := public.finalize_finance_bank_reconciliation(reconciliation.id, 'Automated smoke test');
  IF reconciliation.status <> 'finalized' OR reconciliation.approval_status <> 'approved' THEN
    RAISE EXCEPTION 'Reconciliation was not finalized';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.finance_bank_statement_imports
    WHERE id = import_id_value AND status = 'reconciled'
  ) OR EXISTS (
    SELECT 1 FROM public.finance_bank_statement_transactions
    WHERE import_id = import_id_value AND match_status <> 'reconciled'
  ) THEN RAISE EXCEPTION 'Statement evidence was not locked'; END IF;
END;
$test$;

ROLLBACK;

SELECT 'bank_statement_reconciliation' AS verification, 'pass' AS result;
