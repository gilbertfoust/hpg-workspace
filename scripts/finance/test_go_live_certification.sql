-- Transactional smoke test for the final cutover gate: prior-system report
-- comparison, evidence-backed accountant signoff, bank reconciliation, and
-- activation of one NGO ledger as the system of record. All rows roll back.

BEGIN;

DO $test$
DECLARE
  manager_id uuid;
  ngo_id_value uuid;
  account_row public.finance_accounts;
  bank_gl_id uuid;
  revenue_gl_id uuid;
  bank_account_id uuid;
  stale_entry_id uuid;
  prior_document_id uuid;
  signoff_document_id uuid;
  comparison public.finance_parallel_close_comparisons;
  variance_comparison public.finance_parallel_close_comparisons;
  certification public.finance_go_live_certifications;
  readiness jsonb;
  refreshed_metrics jsonb;
  zero_metrics jsonb := jsonb_build_object(
    'trial_balance_debits', 0,
    'trial_balance_credits', 0,
    'total_assets', 0,
    'total_liabilities_and_net_assets', 0,
    'total_revenue', 0,
    'total_expenses', 0,
    'ending_cash', 0,
    'accounts_receivable', 0,
    'accounts_payable', 0
  );
  bad_metrics jsonb;
  variance_approval_rejected boolean := false;
  premature_activation_rejected boolean := false;
BEGIN
  SELECT profile.id INTO manager_id
  FROM public.profiles profile
  WHERE profile.role IN ('super_admin', 'admin_pm', 'vp_finance')
  ORDER BY profile.created_at LIMIT 1;
  IF manager_id IS NULL THEN RAISE EXCEPTION 'No Finance manager identity'; END IF;
  PERFORM set_config('request.jwt.claim.sub', manager_id::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

  INSERT INTO public.ngos (legal_name, common_name)
  VALUES ('Go-Live Certification Smoke ' || gen_random_uuid()::text, 'Go-Live Smoke')
  RETURNING id INTO ngo_id_value;
  PERFORM public.finance_ensure_fiscal_calendar(ngo_id_value, extract(year FROM CURRENT_DATE)::integer);

  FOR account_row IN
    SELECT * FROM public.finance_accounts WHERE code IN ('1000','1100','2000','3000','4000') AND is_active
  LOOP
    PERFORM public.ensure_finance_ngo_account(
      ngo_id_value, account_row.id, '{}'::jsonb, 'go_live_certification', ngo_id_value
    );
  END LOOP;
  IF (SELECT count(*) FROM public.finance_ngo_accounts WHERE ngo_id = ngo_id_value AND is_active) < 5 THEN
    RAISE EXCEPTION 'Smoke NGO chart of accounts was not activated';
  END IF;

  SELECT id INTO bank_gl_id FROM public.finance_accounts WHERE code = '1000' AND is_active;
  SELECT id INTO revenue_gl_id FROM public.finance_accounts WHERE code = '4000' AND is_active;
  INSERT INTO public.finance_bank_accounts (
    ngo_id, account_kind, account_name, institution_name, last_four,
    linked_finance_account_id, opening_balance, opening_balance_date
  ) VALUES (
    ngo_id_value, 'bank', 'Go-Live Smoke Checking', 'Certification Bank', '0500',
    bank_gl_id, 0, CURRENT_DATE
  ) RETURNING id INTO bank_account_id;
  INSERT INTO public.finance_bank_reconciliations (
    ngo_id, bank_account_id, statement_start_date, statement_end_date,
    beginning_balance, ending_balance, cleared_balance, difference,
    status, finalized_by_user_id, finalized_at, created_by_user_id
  ) VALUES (
    ngo_id_value, bank_account_id, CURRENT_DATE, CURRENT_DATE,
    0, 0, 0, 0, 'finalized', manager_id, now(), manager_id
  );

  INSERT INTO public.documents (
    ngo_id, file_path, file_name, file_type, file_size, category,
    uploaded_by_user_id, review_status, reviewer_user_id, reviewed_at
  ) VALUES (
    ngo_id_value, 'finance/go-live/prior-system-smoke.pdf', 'prior-system-smoke.pdf',
    'application/pdf', 128, 'finance', manager_id, 'approved', manager_id, now()
  ) RETURNING id INTO prior_document_id;
  INSERT INTO public.documents (
    ngo_id, file_path, file_name, file_type, file_size, category,
    uploaded_by_user_id, review_status, reviewer_user_id, reviewed_at
  ) VALUES (
    ngo_id_value, 'finance/go-live/accountant-signoff-smoke.pdf', 'accountant-signoff-smoke.pdf',
    'application/pdf', 128, 'finance', manager_id, 'approved', manager_id, now()
  ) RETURNING id INTO signoff_document_id;

  BEGIN
    PERFORM public.activate_finance_system_of_record(ngo_id_value);
  EXCEPTION WHEN OTHERS THEN
    premature_activation_rejected := position('certification' in lower(SQLERRM)) > 0;
  END;
  IF NOT premature_activation_rejected THEN
    RAISE EXCEPTION 'NGO activated without a certification';
  END IF;

  bad_metrics := zero_metrics || jsonb_build_object('total_assets', 100);
  variance_comparison := public.save_finance_parallel_close(
    ngo_id_value, CURRENT_DATE, CURRENT_DATE, 'Prior System',
    prior_document_id, bad_metrics, 0.01, 'Intentional variance'
  );
  IF variance_comparison.status <> 'variance' OR variance_comparison.is_matched THEN
    RAISE EXCEPTION 'A material prior-system variance was accepted';
  END IF;
  BEGIN
    PERFORM public.approve_finance_parallel_close(variance_comparison.id);
  EXCEPTION WHEN OTHERS THEN
    variance_approval_rejected := position('differs' in lower(SQLERRM)) > 0;
  END;
  IF NOT variance_approval_rejected THEN
    RAISE EXCEPTION 'A mismatched parallel close was approved';
  END IF;

  comparison := public.save_finance_parallel_close(
    ngo_id_value, CURRENT_DATE, CURRENT_DATE, 'Prior System',
    prior_document_id, zero_metrics, 0.01, 'Exact zero-balance parallel close'
  );
  IF comparison.status <> 'matched' OR NOT comparison.is_matched THEN
    RAISE EXCEPTION 'Exact parallel close did not match: %', comparison.variances;
  END IF;
  comparison := public.approve_finance_parallel_close(comparison.id);
  IF comparison.status <> 'approved' OR comparison.approved_at IS NULL THEN
    RAISE EXCEPTION 'Matched parallel close was not approved';
  END IF;

  -- The books can remain perfectly balanced while an approved prior-system
  -- comparison becomes stale. Activation must detect that changed total.
  INSERT INTO public.finance_journal_entries (
    ngo_id, entry_date, memo, status, source_type, created_by_user_id
  ) VALUES (
    ngo_id_value, CURRENT_DATE, 'Stale cutover comparison proof', 'draft',
    'manual', manager_id
  ) RETURNING id INTO stale_entry_id;
  INSERT INTO public.finance_journal_lines (
    journal_entry_id, account_id, debit, credit, memo, ngo_id, line_number
  ) VALUES
    (stale_entry_id, bank_gl_id, 5, 0, 'Changed bank total', ngo_id_value, 1),
    (stale_entry_id, revenue_gl_id, 0, 5, 'Changed revenue total', ngo_id_value, 2);
  PERFORM public.post_finance_journal_entry(stale_entry_id);

  certification := public.save_finance_go_live_certification(
    ngo_id_value,
    jsonb_build_object(
      'cutover_date', CURRENT_DATE,
      'opening_balance_mode', 'new_zero_balance',
      'zero_balance_attested', true,
      'bank_data_mode', 'manual_csv',
      'parallel_close_id', comparison.id,
      'coa_approved', true,
      'restricted_funds_reviewed', true,
      'ap_ar_reviewed', true,
      'access_reviewed', true,
      'receipt_workflow_verified', true,
      'historical_archive_retained', true,
      'accountant_name', 'Smoke Test CPA',
      'accountant_credential', 'CPA',
      'accountant_attestation', 'I certify that the parallel close and supporting balances are accurate.',
      'accountant_signoff_document_id', signoff_document_id,
      'accountant_signed', true
    )
  );
  readiness := public.finance_go_live_readiness(ngo_id_value);
  IF certification.status <> 'draft' OR COALESCE((readiness->>'is_ready')::boolean,false) THEN
    RAISE EXCEPTION 'A stale approved comparison was accepted for cutover';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(readiness->'checks') item
    WHERE item->>'key' = 'parallel_close'
      AND NOT COALESCE((item->>'passed')::boolean,false)
      AND position('stale' in lower(COALESCE(item->>'detail',''))) > 0
  ) THEN RAISE EXCEPTION 'Stale parallel close blocker was not explained'; END IF;

  -- Gross trial-balance activity cannot be erased by an offsetting entry. Run
  -- and approve a fresh prior-system comparison after the intervening activity.
  refreshed_metrics := public.finance_cutover_system_metrics(
    ngo_id_value, CURRENT_DATE, CURRENT_DATE
  ) - 'ecosystem_is_balanced' - 'captured_at';
  comparison := public.save_finance_parallel_close(
    ngo_id_value, CURRENT_DATE, CURRENT_DATE, 'Prior System',
    prior_document_id, refreshed_metrics, 0.01,
    'Fresh comparison after intervening ledger activity'
  );
  comparison := public.approve_finance_parallel_close(comparison.id);
  IF comparison.status <> 'approved' THEN
    RAISE EXCEPTION 'Fresh comparison after ledger activity was not approved';
  END IF;

  certification := public.save_finance_go_live_certification(
    ngo_id_value,
    jsonb_build_object(
      'cutover_date', CURRENT_DATE,
      'opening_balance_mode', 'new_zero_balance',
      'zero_balance_attested', true,
      'bank_data_mode', 'manual_csv',
      'parallel_close_id', comparison.id,
      'coa_approved', true,
      'restricted_funds_reviewed', true,
      'ap_ar_reviewed', true,
      'access_reviewed', true,
      'receipt_workflow_verified', true,
      'historical_archive_retained', true,
      'accountant_name', 'Smoke Test CPA',
      'accountant_credential', 'CPA',
      'accountant_attestation', 'I certify that the parallel close and supporting balances are accurate.',
      'accountant_signoff_document_id', signoff_document_id,
      'accountant_signed', true
    )
  );
  readiness := public.finance_go_live_readiness(ngo_id_value);
  IF certification.status <> 'ready' OR NOT COALESCE((readiness->>'is_ready')::boolean,false) THEN
    RAISE EXCEPTION 'Complete go-live certification was not ready: %', readiness->'blockers';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(readiness->'checks') item
    WHERE NOT COALESCE((item->>'passed')::boolean,false)
  ) THEN RAISE EXCEPTION 'One or more cutover gates failed'; END IF;

  certification := public.activate_finance_system_of_record(ngo_id_value);
  IF certification.status <> 'live' OR certification.activated_at IS NULL THEN
    RAISE EXCEPTION 'Ready NGO did not become the system of record';
  END IF;
  readiness := public.finance_go_live_readiness(ngo_id_value);
  IF NOT COALESCE((readiness->>'is_system_of_record')::boolean,false) THEN
    RAISE EXCEPTION 'Live system-of-record state is not visible in readiness';
  END IF;
END;
$test$;

SELECT 'finance_go_live_certification' AS verification, 'pass' AS result;

ROLLBACK;
