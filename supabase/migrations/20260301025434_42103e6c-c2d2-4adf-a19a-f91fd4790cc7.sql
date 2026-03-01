
-- Create fiscal_periods table
CREATE TABLE public.fiscal_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ngo_id uuid NOT NULL REFERENCES public.ngos(id) ON DELETE CASCADE,
  label text NOT NULL,
  period_type text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  currency_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create validation trigger for period_type instead of CHECK constraint
CREATE OR REPLACE FUNCTION public.validate_fiscal_period_type()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.period_type NOT IN ('monthly', 'quarterly', 'annual') THEN
    RAISE EXCEPTION 'Invalid period_type: %. Must be monthly, quarterly, or annual.', NEW.period_type;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_fiscal_period_type
  BEFORE INSERT OR UPDATE ON public.fiscal_periods
  FOR EACH ROW EXECUTE FUNCTION public.validate_fiscal_period_type();

CREATE TRIGGER update_fiscal_periods_updated_at
  BEFORE UPDATE ON public.fiscal_periods
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.fiscal_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Internal users can view fiscal_periods" ON public.fiscal_periods FOR SELECT USING (public.is_internal_user() OR public.has_ngo_access(ngo_id));
CREATE POLICY "Management can insert fiscal_periods" ON public.fiscal_periods FOR INSERT WITH CHECK (public.is_management());
CREATE POLICY "Management can update fiscal_periods" ON public.fiscal_periods FOR UPDATE USING (public.is_management());
CREATE POLICY "Super admin can delete fiscal_periods" ON public.fiscal_periods FOR DELETE USING (public.is_super_admin());
