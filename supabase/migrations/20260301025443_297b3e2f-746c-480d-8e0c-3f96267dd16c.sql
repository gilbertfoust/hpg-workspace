
-- Create budget_categories table
CREATE TABLE public.budget_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ngo_id uuid REFERENCES public.ngos(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  type text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.validate_budget_category_type()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.type NOT IN ('income', 'expense', 'asset', 'liability', 'equity') THEN
    RAISE EXCEPTION 'Invalid budget category type: %', NEW.type;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_budget_category_type
  BEFORE INSERT OR UPDATE ON public.budget_categories
  FOR EACH ROW EXECUTE FUNCTION public.validate_budget_category_type();

ALTER TABLE public.budget_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Internal users can view budget_categories" ON public.budget_categories FOR SELECT USING (public.is_internal_user() OR (ngo_id IS NOT NULL AND public.has_ngo_access(ngo_id)));
CREATE POLICY "Management can insert budget_categories" ON public.budget_categories FOR INSERT WITH CHECK (public.is_management());
CREATE POLICY "Management can update budget_categories" ON public.budget_categories FOR UPDATE USING (public.is_management());
CREATE POLICY "Super admin can delete budget_categories" ON public.budget_categories FOR DELETE USING (public.is_super_admin());
