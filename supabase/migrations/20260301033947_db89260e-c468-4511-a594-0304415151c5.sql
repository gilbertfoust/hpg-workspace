
-- =====================================================
-- Phase 3: End-of-Year Compliance & Financial Statements
-- =====================================================

-- 1. Add is_locked to fiscal_periods
ALTER TABLE public.fiscal_periods ADD COLUMN IF NOT EXISTS is_locked boolean NOT NULL DEFAULT false;

-- 2. financial_statements table
CREATE TABLE public.financial_statements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ngo_id uuid NOT NULL REFERENCES public.ngos(id),
  fiscal_year int NOT NULL,
  statement_type text NOT NULL,
  data_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_by_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.financial_statements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View financial_statements" ON public.financial_statements FOR SELECT USING (is_internal_user() OR has_ngo_access(ngo_id));
CREATE POLICY "Insert financial_statements" ON public.financial_statements FOR INSERT WITH CHECK (is_internal_user() OR has_ngo_access(ngo_id));
CREATE POLICY "Update financial_statements" ON public.financial_statements FOR UPDATE USING (is_internal_user() OR has_ngo_access(ngo_id));
CREATE POLICY "Delete financial_statements" ON public.financial_statements FOR DELETE USING (is_super_admin());

-- Validation trigger for statement_type
CREATE OR REPLACE FUNCTION public.validate_statement_type()
RETURNS trigger LANGUAGE plpgsql SET search_path = 'public' AS $$
BEGIN
  IF NEW.statement_type NOT IN ('balance_sheet', 'income_statement', 'cash_flows', 'functional_expenses') THEN
    RAISE EXCEPTION 'Invalid statement_type: %. Must be balance_sheet, income_statement, cash_flows, or functional_expenses.', NEW.statement_type;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_statement_type
BEFORE INSERT OR UPDATE ON public.financial_statements
FOR EACH ROW EXECUTE FUNCTION public.validate_statement_type();

-- 3. compliance_packages table
CREATE TABLE public.compliance_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ngo_id uuid NOT NULL REFERENCES public.ngos(id),
  fiscal_year int NOT NULL,
  package_type text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  data_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  file_path text,
  created_by_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.compliance_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View compliance_packages" ON public.compliance_packages FOR SELECT USING (is_internal_user() OR has_ngo_access(ngo_id));
CREATE POLICY "Insert compliance_packages" ON public.compliance_packages FOR INSERT WITH CHECK (is_internal_user() OR has_ngo_access(ngo_id));
CREATE POLICY "Update compliance_packages" ON public.compliance_packages FOR UPDATE USING (is_internal_user() OR has_ngo_access(ngo_id));
CREATE POLICY "Delete compliance_packages" ON public.compliance_packages FOR DELETE USING (is_super_admin());

-- Validation trigger for package_type
CREATE OR REPLACE FUNCTION public.validate_package_type()
RETURNS trigger LANGUAGE plpgsql SET search_path = 'public' AS $$
BEGIN
  IF NEW.package_type NOT IN ('990', 'ngo_annual', 'audit') THEN
    RAISE EXCEPTION 'Invalid package_type: %. Must be 990, ngo_annual, or audit.', NEW.package_type;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_package_type
BEFORE INSERT OR UPDATE ON public.compliance_packages
FOR EACH ROW EXECUTE FUNCTION public.validate_package_type();

-- Validation trigger for compliance package status
CREATE OR REPLACE FUNCTION public.validate_compliance_status()
RETURNS trigger LANGUAGE plpgsql SET search_path = 'public' AS $$
BEGIN
  IF NEW.status NOT IN ('draft', 'ready_for_review', 'approved') THEN
    RAISE EXCEPTION 'Invalid compliance package status: %. Must be draft, ready_for_review, or approved.', NEW.status;
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_compliance_status
BEFORE INSERT OR UPDATE ON public.compliance_packages
FOR EACH ROW EXECUTE FUNCTION public.validate_compliance_status();

-- 4. closing_entries table
CREATE TABLE public.closing_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ngo_id uuid NOT NULL REFERENCES public.ngos(id),
  fiscal_year int NOT NULL,
  account_id uuid NOT NULL REFERENCES public.accounts(id),
  debit numeric NOT NULL DEFAULT 0,
  credit numeric NOT NULL DEFAULT 0,
  memo text,
  created_by_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.closing_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View closing_entries" ON public.closing_entries FOR SELECT USING (is_internal_user() OR has_ngo_access(ngo_id));
CREATE POLICY "Insert closing_entries" ON public.closing_entries FOR INSERT WITH CHECK (is_internal_user() OR has_ngo_access(ngo_id));
CREATE POLICY "Update closing_entries" ON public.closing_entries FOR UPDATE USING (is_internal_user() OR has_ngo_access(ngo_id));
CREATE POLICY "Delete closing_entries" ON public.closing_entries FOR DELETE USING (is_super_admin());

-- 5. Storage bucket for compliance packages
INSERT INTO storage.buckets (id, name, public) VALUES ('compliance-packages', 'compliance-packages', false);

CREATE POLICY "View compliance packages files" ON storage.objects FOR SELECT USING (bucket_id = 'compliance-packages' AND (SELECT is_internal_user()));
CREATE POLICY "Upload compliance packages files" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'compliance-packages' AND (SELECT is_internal_user()));
CREATE POLICY "Update compliance packages files" ON storage.objects FOR UPDATE USING (bucket_id = 'compliance-packages' AND (SELECT is_internal_user()));
CREATE POLICY "Delete compliance packages files" ON storage.objects FOR DELETE USING (bucket_id = 'compliance-packages' AND (SELECT is_super_admin()));
