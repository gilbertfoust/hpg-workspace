-- Phase 2: Nonprofit chart of accounts classification for finance_accounts

ALTER TABLE public.finance_accounts
  ADD COLUMN IF NOT EXISTS is_cash_account boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_contra_account boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS revenue_restriction_class text,
  ADD COLUMN IF NOT EXISTS expense_functional_class text,
  ADD COLUMN IF NOT EXISTS program_classification text,
  ADD COLUMN IF NOT EXISTS grant_reporting_class text,
  ADD COLUMN IF NOT EXISTS form_990_line text,
  ADD COLUMN IF NOT EXISTS financial_statement_line text,
  ADD COLUMN IF NOT EXISTS entity_scope text NOT NULL DEFAULT 'hpg_operating';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'finance_accounts_entity_scope_check') THEN
    ALTER TABLE public.finance_accounts
      ADD CONSTRAINT finance_accounts_entity_scope_check
      CHECK (entity_scope IN ('hpg_operating', 'fiscal_sponsorship', 'consolidated'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'finance_accounts_revenue_restriction_check') THEN
    ALTER TABLE public.finance_accounts
      ADD CONSTRAINT finance_accounts_revenue_restriction_check
      CHECK (
        revenue_restriction_class IS NULL
        OR revenue_restriction_class IN (
          'without_donor_restrictions',
          'with_donor_restrictions',
          'grant_restricted',
          'program_released',
          'pass_through'
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'finance_accounts_expense_functional_check') THEN
    ALTER TABLE public.finance_accounts
      ADD CONSTRAINT finance_accounts_expense_functional_check
      CHECK (
        expense_functional_class IS NULL
        OR expense_functional_class IN ('program', 'management_general', 'fundraising', 'pass_through')
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_finance_accounts_entity_scope ON public.finance_accounts(entity_scope);
CREATE INDEX IF NOT EXISTS idx_finance_accounts_statement_line ON public.finance_accounts(financial_statement_line);

-- Map starter seed subtypes to classification fields where possible
UPDATE public.finance_accounts
SET
  is_cash_account = (account_subtype = 'cash'),
  revenue_restriction_class = CASE account_subtype
    WHEN 'contributions' THEN 'without_donor_restrictions'
    WHEN 'grants' THEN 'grant_restricted'
    WHEN 'program_service' THEN 'without_donor_restrictions'
    WHEN 'admin_fees' THEN 'without_donor_restrictions'
    ELSE revenue_restriction_class
  END,
  expense_functional_class = CASE account_subtype
    WHEN 'program' THEN 'program'
    WHEN 'grant_disbursement' THEN 'pass_through'
    WHEN 'fundraising' THEN 'fundraising'
    WHEN 'administrative' THEN 'management_general'
    ELSE expense_functional_class
  END,
  financial_statement_line = CASE account_type
    WHEN 'asset' THEN 'assets'
    WHEN 'liability' THEN 'liabilities'
    WHEN 'equity' THEN CASE account_subtype
      WHEN 'restricted' THEN 'net_assets_with_donor_restrictions'
      ELSE 'net_assets_without_donor_restrictions'
    END
    WHEN 'revenue' THEN 'revenue'
    WHEN 'expense' THEN 'expenses'
    ELSE financial_statement_line
  END,
  entity_scope = CASE account_subtype
    WHEN 'admin_fees' THEN 'hpg_operating'
    WHEN 'grant_disbursement' THEN 'fiscal_sponsorship'
    ELSE entity_scope
  END
WHERE financial_statement_line IS NULL OR revenue_restriction_class IS NULL OR expense_functional_class IS NULL;
