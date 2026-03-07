
-- Grant Sources: funders/organizations that offer grants
CREATE TABLE public.grant_sources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  website TEXT,
  funder_type TEXT NOT NULL DEFAULT 'foundation',
  country TEXT,
  region TEXT,
  focus_areas TEXT[] DEFAULT '{}',
  min_award NUMERIC,
  max_award NUMERIC,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Grant Opportunities: specific grant programs from sources
CREATE TABLE public.grant_opportunities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_id UUID REFERENCES public.grant_sources(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  eligibility_criteria TEXT,
  focus_areas TEXT[] DEFAULT '{}',
  country TEXT,
  region TEXT,
  min_award NUMERIC,
  max_award NUMERIC,
  deadline TIMESTAMPTZ,
  cycle TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Grant Applications: tracking applications through the pipeline
CREATE TABLE public.grant_applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  opportunity_id UUID REFERENCES public.grant_opportunities(id) ON DELETE SET NULL,
  ngo_id UUID REFERENCES public.ngos(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  stage TEXT NOT NULL DEFAULT 'prospect',
  amount_requested NUMERIC,
  amount_awarded NUMERIC,
  submitted_at TIMESTAMPTZ,
  awarded_at TIMESTAMPTZ,
  reporting_due_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  assigned_user_id UUID REFERENCES public.profiles(id),
  work_item_id UUID REFERENCES public.work_items(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Validation triggers
CREATE OR REPLACE FUNCTION public.validate_grant_opportunity_status()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status NOT IN ('open', 'closed', 'upcoming', 'archived') THEN
    RAISE EXCEPTION 'Invalid grant opportunity status: %', NEW.status;
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_grant_opportunity_status
BEFORE INSERT OR UPDATE ON public.grant_opportunities
FOR EACH ROW EXECUTE FUNCTION public.validate_grant_opportunity_status();

CREATE OR REPLACE FUNCTION public.validate_grant_application_stage()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.stage NOT IN ('prospect', 'researching', 'writing', 'submitted', 'under_review', 'awarded', 'declined', 'reporting', 'closed') THEN
    RAISE EXCEPTION 'Invalid grant application stage: %', NEW.stage;
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_grant_application_stage
BEFORE INSERT OR UPDATE ON public.grant_applications
FOR EACH ROW EXECUTE FUNCTION public.validate_grant_application_stage();

-- Updated_at triggers
CREATE TRIGGER update_grant_sources_updated_at
BEFORE UPDATE ON public.grant_sources
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.grant_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grant_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grant_applications ENABLE ROW LEVEL SECURITY;

-- grant_sources: internal users can view, management can manage
CREATE POLICY "Internal users can view grant sources" ON public.grant_sources
FOR SELECT USING (is_internal_user());

CREATE POLICY "Management can insert grant sources" ON public.grant_sources
FOR INSERT WITH CHECK (is_management());

CREATE POLICY "Management can update grant sources" ON public.grant_sources
FOR UPDATE USING (is_management());

CREATE POLICY "Super admin can delete grant sources" ON public.grant_sources
FOR DELETE USING (is_super_admin());

-- grant_opportunities: internal users can view, management can manage
CREATE POLICY "Internal users can view grant opportunities" ON public.grant_opportunities
FOR SELECT USING (is_internal_user());

CREATE POLICY "Management can insert grant opportunities" ON public.grant_opportunities
FOR INSERT WITH CHECK (is_management());

CREATE POLICY "Management can update grant opportunities" ON public.grant_opportunities
FOR UPDATE USING (is_management());

CREATE POLICY "Super admin can delete grant opportunities" ON public.grant_opportunities
FOR DELETE USING (is_super_admin());

-- grant_applications: NGO access based
CREATE POLICY "View grant applications" ON public.grant_applications
FOR SELECT USING (is_internal_user() OR has_ngo_access(ngo_id));

CREATE POLICY "Insert grant applications" ON public.grant_applications
FOR INSERT WITH CHECK (is_internal_user() OR has_ngo_access(ngo_id));

CREATE POLICY "Update grant applications" ON public.grant_applications
FOR UPDATE USING (is_internal_user() OR has_ngo_access(ngo_id));

CREATE POLICY "Super admin can delete grant applications" ON public.grant_applications
FOR DELETE USING (is_super_admin());
