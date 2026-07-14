-- Avoid overlapping SELECT policies while retaining manager write authority.

DROP POLICY IF EXISTS "finance fiscal periods manage" ON public.finance_fiscal_periods;
DROP POLICY IF EXISTS "finance fiscal periods insert" ON public.finance_fiscal_periods;
CREATE POLICY "finance fiscal periods insert"
  ON public.finance_fiscal_periods FOR INSERT TO authenticated
  WITH CHECK (public.is_finance_ledger_manager());
DROP POLICY IF EXISTS "finance fiscal periods update" ON public.finance_fiscal_periods;
CREATE POLICY "finance fiscal periods update"
  ON public.finance_fiscal_periods FOR UPDATE TO authenticated
  USING (public.is_finance_ledger_manager())
  WITH CHECK (public.is_finance_ledger_manager());
DROP POLICY IF EXISTS "finance fiscal periods delete" ON public.finance_fiscal_periods;
CREATE POLICY "finance fiscal periods delete"
  ON public.finance_fiscal_periods FOR DELETE TO authenticated
  USING (public.is_finance_ledger_manager());

DROP POLICY IF EXISTS "finance opening balances manage" ON public.finance_opening_balances;
DROP POLICY IF EXISTS "finance opening balances insert" ON public.finance_opening_balances;
CREATE POLICY "finance opening balances insert"
  ON public.finance_opening_balances FOR INSERT TO authenticated
  WITH CHECK (public.is_finance_ledger_manager());
DROP POLICY IF EXISTS "finance opening balances update" ON public.finance_opening_balances;
CREATE POLICY "finance opening balances update"
  ON public.finance_opening_balances FOR UPDATE TO authenticated
  USING (public.is_finance_ledger_manager())
  WITH CHECK (public.is_finance_ledger_manager());
DROP POLICY IF EXISTS "finance opening balances delete" ON public.finance_opening_balances;
CREATE POLICY "finance opening balances delete"
  ON public.finance_opening_balances FOR DELETE TO authenticated
  USING (public.is_finance_ledger_manager());

DROP POLICY IF EXISTS "finance year end packages manage" ON public.finance_year_end_packages;
DROP POLICY IF EXISTS "finance year end packages insert" ON public.finance_year_end_packages;
CREATE POLICY "finance year end packages insert"
  ON public.finance_year_end_packages FOR INSERT TO authenticated
  WITH CHECK (public.is_finance_ledger_manager());
DROP POLICY IF EXISTS "finance year end packages update" ON public.finance_year_end_packages;
CREATE POLICY "finance year end packages update"
  ON public.finance_year_end_packages FOR UPDATE TO authenticated
  USING (public.is_finance_ledger_manager())
  WITH CHECK (public.is_finance_ledger_manager());
DROP POLICY IF EXISTS "finance year end packages delete" ON public.finance_year_end_packages;
CREATE POLICY "finance year end packages delete"
  ON public.finance_year_end_packages FOR DELETE TO authenticated
  USING (public.is_finance_ledger_manager());
