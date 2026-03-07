
-- CRM Organizations: donors, partners, vendors, funders
CREATE TABLE public.crm_organizations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  org_type TEXT NOT NULL DEFAULT 'donor',
  industry TEXT,
  website TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  city TEXT,
  state_province TEXT,
  country TEXT,
  description TEXT,
  annual_revenue NUMERIC,
  employee_count INTEGER,
  tags TEXT[] DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by_user_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- CRM Contacts: people at organizations
CREATE TABLE public.crm_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.crm_organizations(id) ON DELETE SET NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  title TEXT,
  department TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  tags TEXT[] DEFAULT '{}',
  created_by_user_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- CRM Interactions: activity log / communication history
CREATE TABLE public.crm_interactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.crm_organizations(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.crm_contacts(id) ON DELETE SET NULL,
  interaction_type TEXT NOT NULL DEFAULT 'note',
  subject TEXT NOT NULL,
  description TEXT,
  interaction_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  logged_by_user_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- CRM Deals: pipeline tracking for donations, grants, partnerships
CREATE TABLE public.crm_deals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.crm_organizations(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.crm_contacts(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  deal_type TEXT NOT NULL DEFAULT 'donation',
  stage TEXT NOT NULL DEFAULT 'lead',
  amount NUMERIC,
  probability INTEGER DEFAULT 50,
  expected_close_date DATE,
  actual_close_date DATE,
  ngo_id UUID REFERENCES public.ngos(id) ON DELETE SET NULL,
  assigned_user_id UUID REFERENCES public.profiles(id),
  notes TEXT,
  tags TEXT[] DEFAULT '{}',
  created_by_user_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Validation triggers
CREATE OR REPLACE FUNCTION public.validate_crm_org_type()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.org_type NOT IN ('donor', 'partner', 'vendor', 'funder', 'government', 'corporate', 'other') THEN
    RAISE EXCEPTION 'Invalid CRM org type: %', NEW.org_type;
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_validate_crm_org_type BEFORE INSERT OR UPDATE ON public.crm_organizations FOR EACH ROW EXECUTE FUNCTION public.validate_crm_org_type();

CREATE OR REPLACE FUNCTION public.validate_crm_interaction_type()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.interaction_type NOT IN ('call', 'email', 'meeting', 'note', 'task', 'event', 'other') THEN
    RAISE EXCEPTION 'Invalid interaction type: %', NEW.interaction_type;
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_validate_crm_interaction_type BEFORE INSERT OR UPDATE ON public.crm_interactions FOR EACH ROW EXECUTE FUNCTION public.validate_crm_interaction_type();

CREATE OR REPLACE FUNCTION public.validate_crm_deal_stage()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.stage NOT IN ('lead', 'qualified', 'proposal', 'negotiation', 'committed', 'won', 'lost', 'closed') THEN
    RAISE EXCEPTION 'Invalid deal stage: %', NEW.stage;
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_validate_crm_deal_stage BEFORE INSERT OR UPDATE ON public.crm_deals FOR EACH ROW EXECUTE FUNCTION public.validate_crm_deal_stage();

-- RLS
ALTER TABLE public.crm_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_deals ENABLE ROW LEVEL SECURITY;

-- crm_organizations
CREATE POLICY "Internal users can view CRM orgs" ON public.crm_organizations FOR SELECT USING (is_internal_user());
CREATE POLICY "Internal users can insert CRM orgs" ON public.crm_organizations FOR INSERT WITH CHECK (is_internal_user());
CREATE POLICY "Internal users can update CRM orgs" ON public.crm_organizations FOR UPDATE USING (is_internal_user());
CREATE POLICY "Super admin can delete CRM orgs" ON public.crm_organizations FOR DELETE USING (is_super_admin());

-- crm_contacts
CREATE POLICY "Internal users can view CRM contacts" ON public.crm_contacts FOR SELECT USING (is_internal_user());
CREATE POLICY "Internal users can insert CRM contacts" ON public.crm_contacts FOR INSERT WITH CHECK (is_internal_user());
CREATE POLICY "Internal users can update CRM contacts" ON public.crm_contacts FOR UPDATE USING (is_internal_user());
CREATE POLICY "Super admin can delete CRM contacts" ON public.crm_contacts FOR DELETE USING (is_super_admin());

-- crm_interactions
CREATE POLICY "Internal users can view CRM interactions" ON public.crm_interactions FOR SELECT USING (is_internal_user());
CREATE POLICY "Internal users can insert CRM interactions" ON public.crm_interactions FOR INSERT WITH CHECK (is_internal_user());
CREATE POLICY "Internal users can update CRM interactions" ON public.crm_interactions FOR UPDATE USING (is_internal_user());
CREATE POLICY "Super admin can delete CRM interactions" ON public.crm_interactions FOR DELETE USING (is_super_admin());

-- crm_deals
CREATE POLICY "Internal users can view CRM deals" ON public.crm_deals FOR SELECT USING (is_internal_user());
CREATE POLICY "Internal users can insert CRM deals" ON public.crm_deals FOR INSERT WITH CHECK (is_internal_user());
CREATE POLICY "Internal users can update CRM deals" ON public.crm_deals FOR UPDATE USING (is_internal_user());
CREATE POLICY "Super admin can delete CRM deals" ON public.crm_deals FOR DELETE USING (is_super_admin());
