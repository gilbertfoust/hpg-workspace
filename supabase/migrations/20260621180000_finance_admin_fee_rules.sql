-- Phase 39: Fiscal sponsorship admin fee rules

CREATE TABLE IF NOT EXISTS public.finance_admin_fee_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'Default admin fee',
  default_percentage numeric(5, 2) NOT NULL DEFAULT 10.00 CHECK (default_percentage >= 0 AND default_percentage <= 100),
  ngo_id uuid REFERENCES public.ngos(id) ON DELETE CASCADE,
  grant_application_id uuid REFERENCES public.grant_applications(id) ON DELETE CASCADE,
  fee_account_id uuid REFERENCES public.finance_accounts(id) ON DELETE SET NULL,
  fee_fund_id uuid REFERENCES public.finance_funds(id) ON DELETE SET NULL,
  pass_through_fund_id uuid REFERENCES public.finance_funds(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_finance_admin_fee_rules_ngo ON public.finance_admin_fee_rules(ngo_id);
CREATE INDEX IF NOT EXISTS idx_finance_admin_fee_rules_grant ON public.finance_admin_fee_rules(grant_application_id);

DROP TRIGGER IF EXISTS trg_finance_admin_fee_rules_updated_at ON public.finance_admin_fee_rules;
CREATE TRIGGER trg_finance_admin_fee_rules_updated_at BEFORE UPDATE ON public.finance_admin_fee_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.finance_calculate_admin_fee(_amount numeric, _ngo_id uuid DEFAULT NULL, _grant_id uuid DEFAULT NULL)
RETURNS TABLE (
  suggested_fee numeric,
  pass_through_amount numeric,
  fee_percentage numeric,
  rule_id uuid
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  rule public.finance_admin_fee_rules;
  pct numeric(5, 2);
BEGIN
  SELECT * INTO rule FROM public.finance_admin_fee_rules
  WHERE is_active = true
    AND (
      (_grant_id IS NOT NULL AND grant_application_id = _grant_id)
      OR (_ngo_id IS NOT NULL AND ngo_id = _ngo_id AND grant_application_id IS NULL)
      OR (ngo_id IS NULL AND grant_application_id IS NULL)
    )
  ORDER BY
    CASE WHEN grant_application_id IS NOT NULL THEN 0 WHEN ngo_id IS NOT NULL THEN 1 ELSE 2 END
  LIMIT 1;

  pct := COALESCE(rule.default_percentage, 10.00);
  suggested_fee := round(_amount * pct / 100, 2);
  pass_through_amount := round(_amount - suggested_fee, 2);
  fee_percentage := pct;
  rule_id := rule.id;
  RETURN NEXT;
END; $$;

REVOKE ALL ON FUNCTION public.finance_calculate_admin_fee(numeric, uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.finance_calculate_admin_fee(numeric, uuid, uuid) TO authenticated;

ALTER TABLE public.finance_admin_fee_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "finance admin fee rules read" ON public.finance_admin_fee_rules;
CREATE POLICY "finance admin fee rules read" ON public.finance_admin_fee_rules FOR SELECT TO authenticated USING (public.can_read_finance_ledger());
DROP POLICY IF EXISTS "finance admin fee rules manage" ON public.finance_admin_fee_rules;
CREATE POLICY "finance admin fee rules manage" ON public.finance_admin_fee_rules FOR ALL TO authenticated USING (public.is_finance_ledger_manager()) WITH CHECK (public.is_finance_ledger_manager());

-- Demo seed rule (clearly labeled)
INSERT INTO public.finance_admin_fee_rules (name, default_percentage, is_active)
SELECT 'Starter default admin fee (demo seed)', 10.00, true
WHERE NOT EXISTS (SELECT 1 FROM public.finance_admin_fee_rules WHERE ngo_id IS NULL AND grant_application_id IS NULL);
