-- Phase 41: Budgets

CREATE TABLE IF NOT EXISTS public.finance_budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  fiscal_year integer NOT NULL,
  scope_type text NOT NULL DEFAULT 'organization' CHECK (scope_type IN ('organization', 'department', 'ngo', 'grant', 'fund')),
  department_id uuid REFERENCES public.org_units(id) ON DELETE SET NULL,
  ngo_id uuid REFERENCES public.ngos(id) ON DELETE SET NULL,
  fund_id uuid REFERENCES public.finance_funds(id) ON DELETE SET NULL,
  grant_application_id uuid REFERENCES public.grant_applications(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'closed')),
  memo text,
  created_by_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.finance_budget_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id uuid NOT NULL REFERENCES public.finance_budgets(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.finance_accounts(id) ON DELETE RESTRICT,
  period_month integer NOT NULL CHECK (period_month >= 1 AND period_month <= 12),
  amount numeric(18, 2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  memo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT finance_budget_lines_unique UNIQUE (budget_id, account_id, period_month)
);

CREATE INDEX IF NOT EXISTS idx_finance_budgets_year ON public.finance_budgets(fiscal_year);
CREATE INDEX IF NOT EXISTS idx_finance_budget_lines_budget ON public.finance_budget_lines(budget_id);

DROP TRIGGER IF EXISTS trg_finance_budgets_updated_at ON public.finance_budgets;
CREATE TRIGGER trg_finance_budgets_updated_at BEFORE UPDATE ON public.finance_budgets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_finance_budget_lines_updated_at ON public.finance_budget_lines;
CREATE TRIGGER trg_finance_budget_lines_updated_at BEFORE UPDATE ON public.finance_budget_lines FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.finance_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_budget_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "finance budgets read" ON public.finance_budgets;
CREATE POLICY "finance budgets read" ON public.finance_budgets FOR SELECT TO authenticated USING (public.can_read_finance_ledger());
DROP POLICY IF EXISTS "finance budgets manage" ON public.finance_budgets;
CREATE POLICY "finance budgets manage" ON public.finance_budgets FOR ALL TO authenticated USING (public.is_finance_ledger_manager()) WITH CHECK (public.is_finance_ledger_manager());
DROP POLICY IF EXISTS "finance budget lines read" ON public.finance_budget_lines;
CREATE POLICY "finance budget lines read" ON public.finance_budget_lines FOR SELECT TO authenticated USING (public.can_read_finance_ledger());
DROP POLICY IF EXISTS "finance budget lines manage" ON public.finance_budget_lines;
CREATE POLICY "finance budget lines manage" ON public.finance_budget_lines FOR ALL TO authenticated USING (public.is_finance_ledger_manager()) WITH CHECK (public.is_finance_ledger_manager());
