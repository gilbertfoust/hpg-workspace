-- Finance entity ledger security hardening
--
-- Read-only report overloads should honor the caller's finance RLS policies.
-- Mutation functions remain SECURITY DEFINER because they perform atomic
-- multi-table work and contain explicit role checks.

ALTER FUNCTION public.get_finance_open_fiscal_period(date, uuid, uuid) SECURITY INVOKER;
ALTER FUNCTION public.finance_validate_trial_balance(date, date, uuid) SECURITY INVOKER;
ALTER FUNCTION public.finance_statement_of_financial_position(date, uuid) SECURITY INVOKER;
ALTER FUNCTION public.finance_statement_of_activities(date, date, uuid) SECURITY INVOKER;
ALTER FUNCTION public.finance_statement_of_cash_flows(date, date, uuid) SECURITY INVOKER;
ALTER FUNCTION public.finance_functional_expense_report(date, date, uuid) SECURITY INVOKER;
ALTER FUNCTION public.finance_restricted_fund_report(date, uuid) SECURITY INVOKER;

-- The workspace directory is readable by all internal staff, but NGO creation
-- and editing remain restricted to the existing admin PM / super-admin rules.
DROP POLICY IF EXISTS "Internal users can create NGOs" ON public.ngos;
DROP POLICY IF EXISTS "Internal users can update NGOs" ON public.ngos;

CREATE INDEX IF NOT EXISTS idx_finance_year_end_packages_ngo
  ON public.finance_year_end_packages(ngo_id);
