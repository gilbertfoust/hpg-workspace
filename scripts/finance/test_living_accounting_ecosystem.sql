-- Transactional smoke test for NGO account activation, budget-driven account
-- generation, atomic AR, expense settlement, parent/child integrity, recurring
-- drafts, and provider-neutral integration outboxes. All rows roll back.

BEGIN;

DO $test$
DECLARE
  manager_id uuid;
  ngo_id_value uuid;
  other_ngo_id uuid;
  bank_gl_id uuid;
  revenue_id uuid;
  budget public.finance_budgets;
  budget_account_id uuid;
  bank public.finance_bank_accounts;
  other_entry public.finance_journal_entries;
  payment public.finance_payments;
  expense_request public.finance_expense_requests;
  invoice public.finance_invoices;
  invoice_payment public.finance_invoice_payments;
  budget_report record;
  integrity jsonb;
  recurring_rule public.finance_recurring_rules;
  occurrence public.finance_recurring_occurrences;
  connection public.finance_financial_connections;
  sync_run public.finance_feed_sync_runs;
  queued_payment public.finance_payments;
  payment_intent public.finance_payment_intents;
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
  IF ngo_id_value IS NULL OR other_ngo_id IS NULL THEN RAISE EXCEPTION 'Two NGOs are required'; END IF;
  PERFORM public.finance_ensure_fiscal_calendar(ngo_id_value, extract(year FROM CURRENT_DATE)::integer);
  PERFORM public.finance_ensure_fiscal_calendar(other_ngo_id, extract(year FROM CURRENT_DATE)::integer);

  SELECT id INTO bank_gl_id FROM public.finance_accounts WHERE code = '1000' AND is_active;
  SELECT id INTO revenue_id FROM public.finance_accounts WHERE code = '4000' AND is_active;
  IF bank_gl_id IS NULL OR revenue_id IS NULL THEN RAISE EXCEPTION 'Starter cash and revenue accounts are required'; END IF;

  budget := public.save_finance_budget(
    NULL,
    jsonb_build_object(
      'name', 'Living Ecosystem Smoke Budget',
      'fiscal_year', extract(year FROM CURRENT_DATE)::integer,
      'ngo_id', ngo_id_value
    ),
    NULL
  );
  budget := public.save_finance_budget(
    budget.id,
    '{}'::jsonb,
    jsonb_build_array(
      jsonb_build_object(
        'account_code', '5898', 'account_name', 'Ecosystem Smoke Expense',
        'account_type', 'expense', 'account_subtype', 'program',
        'expense_functional_class', 'program', 'period_month', extract(month FROM CURRENT_DATE)::integer,
        'amount', 100
      ),
      jsonb_build_object(
        'account_code', '5898', 'account_name', 'Ecosystem Smoke Expense',
        'account_type', 'expense', 'account_subtype', 'program',
        'expense_functional_class', 'program', 'period_month', extract(month FROM CURRENT_DATE)::integer,
        'amount', 50
      )
    )
  );
  SELECT id INTO budget_account_id FROM public.finance_accounts WHERE code = '5898';
  IF budget_account_id IS NULL THEN RAISE EXCEPTION 'Budget did not generate the account'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.finance_ngo_accounts
    WHERE ngo_id = ngo_id_value AND account_id = budget_account_id AND is_active
      AND activation_source_type = 'budget'
  ) THEN RAISE EXCEPTION 'Budget account was not activated in the NGO ledger'; END IF;
  IF (SELECT amount FROM public.finance_budget_lines
      WHERE budget_id = budget.id AND account_id = budget_account_id) <> 150 THEN
    RAISE EXCEPTION 'Repeated budget account/month did not add together';
  END IF;

  INSERT INTO public.finance_bank_accounts (
    ngo_id, account_kind, account_name, institution_name, last_four,
    linked_finance_account_id, opening_balance, opening_balance_date
  ) VALUES (
    ngo_id_value, 'bank', 'Ecosystem Smoke Checking', 'Smoke Bank', '8137',
    bank_gl_id, 0, CURRENT_DATE
  ) RETURNING * INTO bank;

  payment := public.create_and_post_finance_expense_transaction(
    ngo_id_value, budget_account_id, bank_gl_id, 'ach', CURRENT_DATE, 40,
    'Smoke Vendor', 'Budget-linked expense', 'ECO-EXP-1',
    NULL, NULL, NULL, NULL, NULL, NULL
  );

  INSERT INTO public.finance_expense_requests (
    requester_user_id, ngo_id, payee_name, expense_date, amount,
    category, business_purpose, budget_id, budget_account_id,
    status, reviewed_by_user_id, reviewed_at
  ) VALUES (
    manager_id, ngo_id_value, 'Smoke Vendor', CURRENT_DATE, 40,
    'program', 'Budget-linked expense', budget.id, budget_account_id,
    'approved', manager_id, now()
  ) RETURNING * INTO expense_request;
  expense_request := public.settle_finance_expense_request(
    expense_request.id, payment.id, 'ECO-EXP-1'
  );
  IF expense_request.status <> 'paid' OR expense_request.journal_entry_id <> payment.journal_entry_id THEN
    RAISE EXCEPTION 'Expense request did not settle to its posted payment';
  END IF;

  INSERT INTO public.finance_journal_entries (
    entry_date, memo, source_type, status, created_by_user_id, ngo_id
  ) VALUES (
    CURRENT_DATE, 'Other NGO isolation entry', 'ecosystem_smoke_other_ngo',
    'draft', manager_id, other_ngo_id
  ) RETURNING * INTO other_entry;
  INSERT INTO public.finance_journal_lines (
    journal_entry_id, account_id, debit, credit, memo, ngo_id, line_number
  ) VALUES
    (other_entry.id, budget_account_id, 999, 0, 'Other NGO expense', other_ngo_id, 1),
    (other_entry.id, bank_gl_id, 0, 999, 'Other NGO cash', other_ngo_id, 2);
  other_entry := public.post_finance_journal_entry(other_entry.id);

  SELECT * INTO budget_report FROM public.finance_budget_vs_actual_report(
    budget.id, date_trunc('year', CURRENT_DATE)::date,
    (date_trunc('year', CURRENT_DATE) + interval '1 year - 1 day')::date
  ) WHERE account_id = budget_account_id;
  IF round(budget_report.actual_amount, 2) <> 40 THEN
    RAISE EXCEPTION 'Budget actual leaked across NGOs: %', budget_report.actual_amount;
  END IF;

  invoice := public.save_finance_invoice(
    NULL,
    jsonb_build_object(
      'ngo_id', ngo_id_value,
      'customer_name', 'Smoke Grantor',
      'invoice_date', CURRENT_DATE,
      'due_date', CURRENT_DATE + 30,
      'memo', 'Living AR smoke invoice'
    ),
    jsonb_build_array(
      jsonb_build_object(
        'account_id', revenue_id, 'description', 'Grant receivable',
        'amount', 250
      )
    )
  );
  invoice := public.issue_finance_invoice(invoice.id);
  IF invoice.status <> 'sent' OR invoice.journal_entry_id IS NULL THEN
    RAISE EXCEPTION 'Invoice was not issued into the ledger';
  END IF;
  IF NOT (public.finance_validate_trial_balance(CURRENT_DATE, CURRENT_DATE, ngo_id_value)->>'is_balanced')::boolean THEN
    RAISE EXCEPTION 'Invoice issue unbalanced the NGO ledger';
  END IF;

  invoice_payment := public.record_finance_invoice_payment(
    invoice.id, CURRENT_DATE, 100, bank.id, 'ach', 'Partial grant receipt', NULL
  );
  IF invoice_payment.journal_entry_id IS NULL THEN RAISE EXCEPTION 'AR receipt was not posted'; END IF;
  invoice := public.write_off_finance_invoice(invoice.id, 150, 'Uncollectible smoke remainder');
  IF invoice.status <> 'written_off' THEN RAISE EXCEPTION 'Invoice remainder was not written off'; END IF;

  recurring_rule := public.save_finance_recurring_rule(
    NULL,
    jsonb_build_object(
      'ngo_id', ngo_id_value, 'name', 'Monthly smoke accrual',
      'cadence', 'monthly', 'start_date', CURRENT_DATE,
      'next_run_on', CURRENT_DATE
    ),
    jsonb_build_object(
      'memo', 'Reviewable recurring smoke draft',
      'lines', jsonb_build_array(
        jsonb_build_object('account_id', budget_account_id, 'debit', 10, 'credit', 0),
        jsonb_build_object('account_id', bank_gl_id, 'debit', 0, 'credit', 10)
      )
    )
  );
  SELECT * INTO occurrence FROM public.generate_due_finance_recurring_drafts(CURRENT_DATE)
  WHERE rule_id = recurring_rule.id LIMIT 1;
  IF occurrence.status <> 'draft_generated' OR occurrence.journal_entry_id IS NULL THEN
    RAISE EXCEPTION 'Recurring rule did not create a reviewable journal draft';
  END IF;
  IF (SELECT status FROM public.finance_journal_entries WHERE id = occurrence.journal_entry_id) <> 'draft' THEN
    RAISE EXCEPTION 'Recurring automation bypassed review and posted automatically';
  END IF;

  INSERT INTO public.finance_financial_connections (
    ngo_id, bank_account_id, provider, external_connection_id,
    secret_reference, institution_name, status, created_by_user_id
  ) VALUES (
    ngo_id_value, bank.id, 'sandbox', gen_random_uuid()::text,
    'vault://finance-smoke-connection', 'Smoke Bank', 'active', manager_id
  ) RETURNING * INTO connection;
  sync_run := public.queue_finance_feed_sync(connection.id, CURRENT_DATE - 7, CURRENT_DATE);
  IF sync_run.status <> 'queued' OR NOT EXISTS (
    SELECT 1 FROM public.finance_integration_outbox
    WHERE entity_type = 'finance_feed_sync_run' AND entity_id = sync_run.id AND status = 'pending'
  ) THEN RAISE EXCEPTION 'Bank feed sync was not queued durably'; END IF;

  INSERT INTO public.finance_payments (
    payment_type, payment_date, amount, status, bank_account_id,
    payee_name, ngo_id, expense_account_id, payment_method,
    memo, created_by_user_id
  ) VALUES (
    'reimbursement', CURRENT_DATE, 25, 'pending_approval', bank.id,
    'Provider smoke payee', ngo_id_value, budget_account_id, 'ach',
    'Provider-neutral payment intent', manager_id
  ) RETURNING * INTO queued_payment;
  payment_intent := public.queue_finance_payment_intent(queued_payment.id, 'sandbox', 'USD');
  IF payment_intent.status <> 'queued' OR NOT EXISTS (
    SELECT 1 FROM public.finance_integration_outbox
    WHERE entity_type = 'finance_payment_intent' AND entity_id = payment_intent.id AND status = 'pending'
  ) THEN RAISE EXCEPTION 'Payment intent was not queued durably'; END IF;

  integrity := public.finance_accounting_integrity(
    ngo_id_value, date_trunc('year', CURRENT_DATE)::date, CURRENT_DATE
  );
  IF NOT COALESCE((integrity->>'is_balanced')::boolean, false) THEN
    RAISE EXCEPTION 'Accounting ecosystem did not tie: %', integrity->'blocking_failures';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(integrity->'checks') item
    WHERE NOT COALESCE((item->>'is_balanced')::boolean, false)
  ) THEN RAISE EXCEPTION 'One or more parent/child checks failed'; END IF;
END;
$test$;

SELECT 'finance_living_accounting_ecosystem' AS verification, 'pass' AS result;

ROLLBACK;
