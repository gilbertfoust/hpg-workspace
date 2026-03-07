
-- Create budgets table
CREATE TABLE public.budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ngo_id uuid NOT NULL REFERENCES public.ngos(id) ON DELETE CASCADE,
  fiscal_period_id uuid NOT NULL REFERENCES public.fiscal_periods(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.budget_categories(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 0,
  notes text,
  created_by_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER update_budgets_updated_at BEFORE UPDATE ON public.budgets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View budgets" ON public.budgets FOR SELECT USING (public.is_internal_user() OR public.has_ngo_access(ngo_id));
CREATE POLICY "Internal users can insert budgets" ON public.budgets FOR INSERT WITH CHECK (public.is_internal_user() OR public.has_ngo_access(ngo_id));
CREATE POLICY "Internal users can update budgets" ON public.budgets FOR UPDATE USING (public.is_internal_user() OR public.has_ngo_access(ngo_id));
CREATE POLICY "Super admin can delete budgets" ON public.budgets FOR DELETE USING (public.is_super_admin());

-- Create actuals table
CREATE TABLE public.actuals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ngo_id uuid NOT NULL REFERENCES public.ngos(id) ON DELETE CASCADE,
  fiscal_period_id uuid NOT NULL REFERENCES public.fiscal_periods(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.budget_categories(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'manual_entry',
  supporting_document_url text,
  created_by_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER update_actuals_updated_at BEFORE UPDATE ON public.actuals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.actuals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View actuals" ON public.actuals FOR SELECT USING (public.is_internal_user() OR public.has_ngo_access(ngo_id));
CREATE POLICY "Internal users can insert actuals" ON public.actuals FOR INSERT WITH CHECK (public.is_internal_user() OR public.has_ngo_access(ngo_id));
CREATE POLICY "Internal users can update actuals" ON public.actuals FOR UPDATE USING (public.is_internal_user() OR public.has_ngo_access(ngo_id));
CREATE POLICY "Super admin can delete actuals" ON public.actuals FOR DELETE USING (public.is_super_admin());

-- Create financial_review_status table
CREATE TABLE public.financial_review_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ngo_id uuid NOT NULL REFERENCES public.ngos(id) ON DELETE CASCADE,
  fiscal_period_id uuid NOT NULL REFERENCES public.fiscal_periods(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'not_started',
  reviewer_id uuid,
  comments text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ngo_id, fiscal_period_id)
);

CREATE OR REPLACE FUNCTION public.validate_financial_review_status()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status NOT IN ('not_started', 'awaiting_ngo', 'under_review', 'approved', 'needs_revision') THEN
    RAISE EXCEPTION 'Invalid financial review status: %', NEW.status;
  END IF;
  NEW.last_updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_financial_review_status
  BEFORE INSERT OR UPDATE ON public.financial_review_status
  FOR EACH ROW EXECUTE FUNCTION public.validate_financial_review_status();

ALTER TABLE public.financial_review_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View financial_review_status" ON public.financial_review_status FOR SELECT USING (public.is_internal_user() OR public.has_ngo_access(ngo_id));
CREATE POLICY "Management can insert financial_review_status" ON public.financial_review_status FOR INSERT WITH CHECK (public.is_management());
CREATE POLICY "Management can update financial_review_status" ON public.financial_review_status FOR UPDATE USING (public.is_management());
CREATE POLICY "Super admin can delete financial_review_status" ON public.financial_review_status FOR DELETE USING (public.is_super_admin());
