
-- Assets registry
CREATE TABLE public.assets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ngo_id UUID NOT NULL REFERENCES public.ngos(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'equipment',
  asset_tag TEXT,
  serial_number TEXT,
  acquisition_date DATE,
  acquisition_cost NUMERIC NOT NULL DEFAULT 0,
  salvage_value NUMERIC NOT NULL DEFAULT 0,
  useful_life_months INTEGER,
  depreciation_method TEXT NOT NULL DEFAULT 'straight_line',
  location TEXT,
  assigned_to_staff_id UUID REFERENCES public.staff_profiles(id) ON DELETE SET NULL,
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active',
  disposed_date DATE,
  disposed_value NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Depreciation records
CREATE TABLE public.asset_depreciation (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  ngo_id UUID NOT NULL REFERENCES public.ngos(id) ON DELETE CASCADE,
  period_label TEXT NOT NULL,
  period_date DATE NOT NULL,
  depreciation_amount NUMERIC NOT NULL DEFAULT 0,
  accumulated_depreciation NUMERIC NOT NULL DEFAULT 0,
  book_value NUMERIC NOT NULL DEFAULT 0,
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Maintenance tracking
CREATE TABLE public.asset_maintenance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  ngo_id UUID NOT NULL REFERENCES public.ngos(id) ON DELETE CASCADE,
  maintenance_type TEXT NOT NULL DEFAULT 'preventive',
  description TEXT NOT NULL,
  scheduled_date DATE,
  completed_date DATE,
  cost NUMERIC,
  vendor_org_id UUID REFERENCES public.crm_organizations(id) ON DELETE SET NULL,
  assigned_to_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'scheduled',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Validation triggers
CREATE OR REPLACE FUNCTION public.validate_asset_status()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status NOT IN ('active', 'in_storage', 'maintenance', 'disposed', 'lost') THEN
    RAISE EXCEPTION 'Invalid asset status: %', NEW.status;
  END IF;
  IF NEW.category NOT IN ('equipment', 'furniture', 'vehicle', 'technology', 'building', 'land', 'software', 'other') THEN
    RAISE EXCEPTION 'Invalid asset category: %', NEW.category;
  END IF;
  IF NEW.depreciation_method NOT IN ('straight_line', 'declining_balance', 'none') THEN
    RAISE EXCEPTION 'Invalid depreciation method: %', NEW.depreciation_method;
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_validate_asset_status BEFORE INSERT OR UPDATE ON public.assets FOR EACH ROW EXECUTE FUNCTION public.validate_asset_status();

CREATE OR REPLACE FUNCTION public.validate_maintenance_status()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status NOT IN ('scheduled', 'in_progress', 'completed', 'canceled') THEN
    RAISE EXCEPTION 'Invalid maintenance status: %', NEW.status;
  END IF;
  IF NEW.maintenance_type NOT IN ('preventive', 'corrective', 'inspection', 'upgrade') THEN
    RAISE EXCEPTION 'Invalid maintenance type: %', NEW.maintenance_type;
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_validate_maintenance_status BEFORE INSERT OR UPDATE ON public.asset_maintenance FOR EACH ROW EXECUTE FUNCTION public.validate_maintenance_status();

-- RLS
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_depreciation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_maintenance ENABLE ROW LEVEL SECURITY;

-- assets
CREATE POLICY "View assets" ON public.assets FOR SELECT USING (is_internal_user() OR has_ngo_access(ngo_id));
CREATE POLICY "Insert assets" ON public.assets FOR INSERT WITH CHECK (is_internal_user() OR has_ngo_access(ngo_id));
CREATE POLICY "Update assets" ON public.assets FOR UPDATE USING (is_internal_user() OR has_ngo_access(ngo_id));
CREATE POLICY "Delete assets" ON public.assets FOR DELETE USING (is_super_admin());

-- asset_depreciation
CREATE POLICY "View depreciation" ON public.asset_depreciation FOR SELECT USING (is_internal_user() OR has_ngo_access(ngo_id));
CREATE POLICY "Insert depreciation" ON public.asset_depreciation FOR INSERT WITH CHECK (is_internal_user() OR has_ngo_access(ngo_id));
CREATE POLICY "Update depreciation" ON public.asset_depreciation FOR UPDATE USING (is_internal_user() OR has_ngo_access(ngo_id));
CREATE POLICY "Delete depreciation" ON public.asset_depreciation FOR DELETE USING (is_super_admin());

-- asset_maintenance
CREATE POLICY "View maintenance" ON public.asset_maintenance FOR SELECT USING (is_internal_user() OR has_ngo_access(ngo_id));
CREATE POLICY "Insert maintenance" ON public.asset_maintenance FOR INSERT WITH CHECK (is_internal_user() OR has_ngo_access(ngo_id));
CREATE POLICY "Update maintenance" ON public.asset_maintenance FOR UPDATE USING (is_internal_user() OR has_ngo_access(ngo_id));
CREATE POLICY "Delete maintenance" ON public.asset_maintenance FOR DELETE USING (is_super_admin());
