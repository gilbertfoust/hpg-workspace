-- Run after `supabase db push` to verify the Finance operational control plane.
-- This script is read-only and safe to run against a deployed environment.

DO $$
DECLARE
  table_name text;
  function_signature text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'finance_expense_requests',
    'finance_workflow_events',
    'finance_budgets',
    'finance_budget_lines',
    'purchase_requests'
  ] LOOP
    IF to_regclass('public.' || table_name) IS NULL THEN
      RAISE EXCEPTION 'Required Finance table is missing: %', table_name;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = table_name
        AND c.relrowsecurity
    ) THEN
      RAISE EXCEPTION 'RLS is not enabled for Finance table: %', table_name;
    END IF;
  END LOOP;

  FOREACH function_signature IN ARRAY ARRAY[
    'public.save_finance_expense_request(uuid,jsonb)',
    'public.submit_finance_expense_request(uuid)',
    'public.review_finance_expense_request(uuid,text,text)',
    'public.mark_finance_expense_request_paid(uuid,text)',
    'public.save_purchase_request(uuid,jsonb)',
    'public.submit_purchase_request(uuid)',
    'public.review_purchase_request(uuid,text,text)',
    'public.save_finance_budget(uuid,jsonb,jsonb)',
    'public.submit_finance_budget(uuid)',
    'public.review_finance_budget(uuid,text,text)'
  ] LOOP
    IF to_regprocedure(function_signature) IS NULL THEN
      RAISE EXCEPTION 'Required Finance RPC is missing: %', function_signature;
    END IF;

    IF has_function_privilege('anon', function_signature, 'EXECUTE') THEN
      RAISE EXCEPTION 'Anonymous role can execute protected Finance RPC: %', function_signature;
    END IF;
  END LOOP;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'finance_expense_requests'
      AND roles @> ARRAY['authenticated'::name]
      AND cmd = 'SELECT'
  ) THEN
    RAISE EXCEPTION 'Expense request read policy is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'is_finance_staff'
      AND pg_get_functiondef(p.oid) ILIKE '%department_name%finance%'
  ) THEN
    RAISE EXCEPTION 'Finance staff authority is not department-scoped';
  END IF;
END;
$$;

SELECT
  'finance_operational_workflows' AS verification,
  'pass' AS result,
  now() AS verified_at;
