
-- FX Rates table
CREATE TABLE public.fx_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_currency TEXT NOT NULL DEFAULT 'USD',
  to_currency TEXT NOT NULL,
  rate NUMERIC NOT NULL,
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  source TEXT DEFAULT 'manual',
  created_by_user_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Country compliance profiles
CREATE TABLE public.country_compliance_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code TEXT NOT NULL,
  country_name TEXT NOT NULL,
  registration_required BOOLEAN DEFAULT false,
  tax_filing_required BOOLEAN DEFAULT false,
  annual_audit_required BOOLEAN DEFAULT false,
  filing_deadline TEXT,
  regulatory_body TEXT,
  requirements_json JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Localized COA mappings
CREATE TABLE public.localized_coa_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code TEXT NOT NULL,
  local_account_code TEXT NOT NULL,
  local_account_name TEXT NOT NULL,
  standard_account_id UUID REFERENCES public.accounts(id),
  mapping_notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Treasury positions
CREATE TABLE public.treasury_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ngo_id UUID REFERENCES public.ngos(id),
  account_name TEXT NOT NULL,
  bank_name TEXT,
  currency TEXT NOT NULL DEFAULT 'USD',
  current_balance NUMERIC NOT NULL DEFAULT 0,
  as_of_date DATE NOT NULL DEFAULT CURRENT_DATE,
  account_type TEXT NOT NULL DEFAULT 'checking',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.fx_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.country_compliance_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.localized_coa_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treasury_positions ENABLE ROW LEVEL SECURITY;

-- RLS policies - internal users can access
CREATE POLICY "Internal users can manage fx_rates" ON public.fx_rates FOR ALL TO authenticated USING (public.is_internal_user()) WITH CHECK (public.is_internal_user());
CREATE POLICY "Internal users can manage compliance_profiles" ON public.country_compliance_profiles FOR ALL TO authenticated USING (public.is_internal_user()) WITH CHECK (public.is_internal_user());
CREATE POLICY "Internal users can manage coa_mappings" ON public.localized_coa_mappings FOR ALL TO authenticated USING (public.is_internal_user()) WITH CHECK (public.is_internal_user());
CREATE POLICY "Internal users can manage treasury" ON public.treasury_positions FOR ALL TO authenticated USING (public.is_internal_user()) WITH CHECK (public.is_internal_user());

-- Validation triggers
CREATE OR REPLACE FUNCTION public.validate_treasury_account_type()
RETURNS trigger LANGUAGE plpgsql SET search_path = 'public' AS $$
BEGIN
  IF NEW.account_type NOT IN ('checking', 'savings', 'money_market', 'cd', 'investment', 'petty_cash') THEN
    RAISE EXCEPTION 'Invalid treasury account type: %', NEW.account_type;
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_treasury_account_type BEFORE INSERT OR UPDATE ON public.treasury_positions FOR EACH ROW EXECUTE FUNCTION public.validate_treasury_account_type();
