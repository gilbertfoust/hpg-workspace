-- Phase 1 atomic posting verification script (run in Supabase SQL editor with service role).
-- Replace placeholder UUIDs before running against a non-production sandbox.

-- ---------------------------------------------------------------------------
-- 1. validate_balanced_journal_lines
-- ---------------------------------------------------------------------------
SELECT public.validate_balanced_journal_lines(
  '[
    {"account_id":"00000000-0000-0000-0000-000000000001","debit":100,"credit":0},
    {"account_id":"00000000-0000-0000-0000-000000000002","debit":0,"credit":100}
  ]'::jsonb
) AS balanced_ok;

SELECT public.validate_balanced_journal_lines(
  '[
    {"account_id":"00000000-0000-0000-0000-000000000001","debit":100,"credit":0},
    {"account_id":"00000000-0000-0000-0000-000000000002","debit":0,"credit":50}
  ]'::jsonb
) AS unbalanced_rejected;

-- ---------------------------------------------------------------------------
-- 2. Legacy post_transaction (requires real NGO, accounts, open fiscal period)
-- ---------------------------------------------------------------------------
-- BEGIN;
-- SELECT public.post_transaction(
--   '<ngo_id>'::uuid,
--   CURRENT_DATE,
--   'Phase 1 test transaction',
--   'TEST-001',
--   'qa_script',
--   '<fiscal_period_id>'::uuid,
--   '<journal_lines_jsonb>'::jsonb,
--   NULL
-- );
-- ROLLBACK;

-- ---------------------------------------------------------------------------
-- 3. Finance save_finance_journal_entry (requires finance manager JWT context)
-- ---------------------------------------------------------------------------
-- BEGIN;
-- SELECT public.save_finance_journal_entry(
--   NULL,
--   CURRENT_DATE,
--   'Phase 1 finance draft test',
--   'qa_script',
--   NULL,
--   '<finance_lines_jsonb>'::jsonb
-- );
-- ROLLBACK;

-- ---------------------------------------------------------------------------
-- Phase 12 expanded QA script — run read-only validations after migrations applied.

SELECT 'validate_balanced' AS test, (public.validate_balanced_journal_lines('[
  {"account_id":"00000000-0000-0000-0000-000000000001","debit":50,"credit":0},
  {"account_id":"00000000-0000-0000-0000-000000000002","debit":0,"credit":50}
]'::jsonb)->>'valid')::boolean AS pass;

SELECT 'validate_unbalanced' AS test, NOT (public.validate_balanced_journal_lines('[
  {"account_id":"00000000-0000-0000-0000-000000000001","debit":50,"credit":0},
  {"account_id":"00000000-0000-0000-0000-000000000002","debit":0,"credit":25}
]'::jsonb)->>'valid')::boolean AS pass;

SELECT 'finance_periods_seeded' AS test, EXISTS (SELECT 1 FROM public.finance_fiscal_periods) AS pass;

SELECT 'coa_classification_columns' AS test,
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'finance_accounts' AND column_name = 'revenue_restriction_class'
  ) AS pass;

SELECT 'ar_tables_exist' AS test,
  to_regclass('public.finance_invoices') IS NOT NULL
  AND to_regclass('public.finance_donors') IS NOT NULL AS pass;

SELECT 'year_end_rpc_exists' AS test,
  EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'generate_finance_year_end_package'
  ) AS pass;
