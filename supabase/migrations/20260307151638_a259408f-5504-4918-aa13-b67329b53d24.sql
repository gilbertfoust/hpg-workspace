
-- =============================================
-- 1. REMINDERS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_item_id uuid REFERENCES public.work_items(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  remind_at timestamptz NOT NULL,
  channel text DEFAULT 'in_app',
  status text DEFAULT 'scheduled',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own reminders" ON public.reminders
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can create own reminders" ON public.reminders
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own reminders" ON public.reminders
  FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can delete own reminders" ON public.reminders
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- =============================================
-- 2. TICKETS TABLE (IT)
-- =============================================
CREATE TABLE IF NOT EXISTS public.tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject text NOT NULL,
  description text NOT NULL DEFAULT '',
  reporter_user_id uuid REFERENCES public.profiles(id) NOT NULL,
  severity text NOT NULL DEFAULT 'medium',
  status text NOT NULL DEFAULT 'submitted',
  assigned_to_user_id uuid REFERENCES public.profiles(id),
  related_ngo_id uuid REFERENCES public.ngos(id),
  work_item_id uuid REFERENCES public.work_items(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Internal users can view tickets" ON public.tickets
  FOR SELECT TO authenticated USING (is_internal_user());
CREATE POLICY "Internal users can create tickets" ON public.tickets
  FOR INSERT TO authenticated WITH CHECK (is_internal_user());
CREATE POLICY "Internal users can update tickets" ON public.tickets
  FOR UPDATE TO authenticated USING (is_internal_user());
CREATE POLICY "Super admin can delete tickets" ON public.tickets
  FOR DELETE TO authenticated USING (is_super_admin());

CREATE TRIGGER update_tickets_updated_at BEFORE UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- 3. ACCESS_REQUESTS TABLE (IT)
-- =============================================
CREATE TABLE IF NOT EXISTS public.access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_type text NOT NULL,
  target_user text NOT NULL,
  requested_by_user_id uuid REFERENCES public.profiles(id) NOT NULL,
  justification text NOT NULL DEFAULT '',
  priority text NOT NULL DEFAULT 'medium',
  status text NOT NULL DEFAULT 'submitted',
  work_item_id uuid REFERENCES public.work_items(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.access_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Internal users can view access requests" ON public.access_requests
  FOR SELECT TO authenticated USING (is_internal_user());
CREATE POLICY "Internal users can create access requests" ON public.access_requests
  FOR INSERT TO authenticated WITH CHECK (is_internal_user());
CREATE POLICY "Internal users can update access requests" ON public.access_requests
  FOR UPDATE TO authenticated USING (is_internal_user());
CREATE POLICY "Super admin can delete access requests" ON public.access_requests
  FOR DELETE TO authenticated USING (is_super_admin());

CREATE TRIGGER update_access_requests_updated_at BEFORE UPDATE ON public.access_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- 4. APPLICANTS TABLE (HR)
-- =============================================
CREATE TABLE IF NOT EXISTS public.applicants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  email text,
  phone text,
  role_applied_for text,
  stage text NOT NULL DEFAULT 'Applied',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.applicants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Internal users can view applicants" ON public.applicants
  FOR SELECT TO authenticated USING (is_internal_user());
CREATE POLICY "Internal users can create applicants" ON public.applicants
  FOR INSERT TO authenticated WITH CHECK (is_internal_user());
CREATE POLICY "Internal users can update applicants" ON public.applicants
  FOR UPDATE TO authenticated USING (is_internal_user());
CREATE POLICY "Super admin can delete applicants" ON public.applicants
  FOR DELETE TO authenticated USING (is_super_admin());

CREATE OR REPLACE FUNCTION public.validate_applicant_stage()
  RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.stage NOT IN ('Applied', 'Screening', 'Interviewing', 'Offer', 'Hired', 'Rejected') THEN
    RAISE EXCEPTION 'Invalid applicant stage: %', NEW.stage;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_applicant_stage_trigger BEFORE INSERT OR UPDATE ON public.applicants
  FOR EACH ROW EXECUTE FUNCTION public.validate_applicant_stage();

-- =============================================
-- 5. JOB_REQUISITIONS TABLE (HR)
-- =============================================
CREATE TABLE IF NOT EXISTS public.job_requisitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  department_id uuid REFERENCES public.org_units(id),
  location text,
  employment_type text,
  status text NOT NULL DEFAULT 'Open',
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.job_requisitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Internal users can view requisitions" ON public.job_requisitions
  FOR SELECT TO authenticated USING (is_internal_user());
CREATE POLICY "Internal users can create requisitions" ON public.job_requisitions
  FOR INSERT TO authenticated WITH CHECK (is_internal_user());
CREATE POLICY "Internal users can update requisitions" ON public.job_requisitions
  FOR UPDATE TO authenticated USING (is_internal_user());
CREATE POLICY "Super admin can delete requisitions" ON public.job_requisitions
  FOR DELETE TO authenticated USING (is_super_admin());

CREATE OR REPLACE FUNCTION public.validate_requisition_status()
  RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status NOT IN ('Open', 'Paused', 'Closed') THEN
    RAISE EXCEPTION 'Invalid requisition status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_requisition_status_trigger BEFORE INSERT OR UPDATE ON public.job_requisitions
  FOR EACH ROW EXECUTE FUNCTION public.validate_requisition_status();

-- =============================================
-- 6. INTERVIEWS TABLE (HR)
-- =============================================
CREATE TABLE IF NOT EXISTS public.interviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id uuid REFERENCES public.applicants(id) ON DELETE CASCADE NOT NULL,
  interviewer_user_id uuid REFERENCES public.profiles(id),
  interview_date timestamptz NOT NULL,
  recommendation text,
  notes text,
  rubric_scores jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.interviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Internal users can view interviews" ON public.interviews
  FOR SELECT TO authenticated USING (is_internal_user());
CREATE POLICY "Internal users can create interviews" ON public.interviews
  FOR INSERT TO authenticated WITH CHECK (is_internal_user());
CREATE POLICY "Internal users can update interviews" ON public.interviews
  FOR UPDATE TO authenticated USING (is_internal_user());
CREATE POLICY "Super admin can delete interviews" ON public.interviews
  FOR DELETE TO authenticated USING (is_super_admin());

-- =============================================
-- 7. FUNDERS TABLE (Development)
-- =============================================
CREATE TABLE IF NOT EXISTS public.funders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text,
  website text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.funders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Internal users can view funders" ON public.funders
  FOR SELECT TO authenticated USING (is_internal_user());
CREATE POLICY "Internal users can create funders" ON public.funders
  FOR INSERT TO authenticated WITH CHECK (is_internal_user());
CREATE POLICY "Internal users can update funders" ON public.funders
  FOR UPDATE TO authenticated USING (is_internal_user());
CREATE POLICY "Super admin can delete funders" ON public.funders
  FOR DELETE TO authenticated USING (is_super_admin());

CREATE TRIGGER update_funders_updated_at BEFORE UPDATE ON public.funders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- 8. PROPOSALS TABLE (Development)
-- =============================================
CREATE TABLE IF NOT EXISTS public.proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  phase text DEFAULT 'Identified',
  internal_owner uuid REFERENCES public.profiles(id),
  requested_amount numeric,
  awarded_amount numeric,
  submitted_at timestamptz,
  decision_at timestamptz,
  notes text,
  ngo_id uuid REFERENCES public.ngos(id),
  grant_opportunity_id uuid REFERENCES public.grant_opportunities(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Internal users can view proposals" ON public.proposals
  FOR SELECT TO authenticated USING (is_internal_user());
CREATE POLICY "Internal users can create proposals" ON public.proposals
  FOR INSERT TO authenticated WITH CHECK (is_internal_user());
CREATE POLICY "Internal users can update proposals" ON public.proposals
  FOR UPDATE TO authenticated USING (is_internal_user());
CREATE POLICY "Super admin can delete proposals" ON public.proposals
  FOR DELETE TO authenticated USING (is_super_admin());

CREATE TRIGGER update_proposals_updated_at BEFORE UPDATE ON public.proposals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.validate_proposal_phase()
  RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.phase NOT IN ('Identified', 'Qualified', 'Drafting', 'Submitted', 'Awarded', 'Declined') THEN
    RAISE EXCEPTION 'Invalid proposal phase: %', NEW.phase;
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_proposal_phase_trigger BEFORE INSERT OR UPDATE ON public.proposals
  FOR EACH ROW EXECUTE FUNCTION public.validate_proposal_phase();

-- =============================================
-- 9. PARTNERS TABLE (Partnerships)
-- =============================================
CREATE TABLE IF NOT EXISTS public.partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text,
  region text,
  status text,
  primary_contact text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Internal users can view partners" ON public.partners
  FOR SELECT TO authenticated USING (is_internal_user());
CREATE POLICY "Internal users can create partners" ON public.partners
  FOR INSERT TO authenticated WITH CHECK (is_internal_user());
CREATE POLICY "Internal users can update partners" ON public.partners
  FOR UPDATE TO authenticated USING (is_internal_user());
CREATE POLICY "Super admin can delete partners" ON public.partners
  FOR DELETE TO authenticated USING (is_super_admin());

CREATE TRIGGER update_partners_updated_at BEFORE UPDATE ON public.partners
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- 10. PARTNERSHIP_PIPELINE TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.partnership_pipeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid REFERENCES public.partners(id),
  stage text DEFAULT 'Prospect',
  notes text,
  key_commitments text,
  ngo_id uuid REFERENCES public.ngos(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.partnership_pipeline ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Internal users can view pipeline" ON public.partnership_pipeline
  FOR SELECT TO authenticated USING (is_internal_user());
CREATE POLICY "Internal users can create pipeline records" ON public.partnership_pipeline
  FOR INSERT TO authenticated WITH CHECK (is_internal_user());
CREATE POLICY "Internal users can update pipeline records" ON public.partnership_pipeline
  FOR UPDATE TO authenticated USING (is_internal_user());
CREATE POLICY "Super admin can delete pipeline records" ON public.partnership_pipeline
  FOR DELETE TO authenticated USING (is_super_admin());

CREATE TRIGGER update_partnership_pipeline_updated_at BEFORE UPDATE ON public.partnership_pipeline
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.validate_partnership_stage()
  RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.stage NOT IN ('Prospect', 'Discovery', 'Negotiation', 'MOU Drafting', 'Active', 'Dormant') THEN
    RAISE EXCEPTION 'Invalid partnership stage: %', NEW.stage;
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_partnership_stage_trigger BEFORE INSERT OR UPDATE ON public.partnership_pipeline
  FOR EACH ROW EXECUTE FUNCTION public.validate_partnership_stage();

-- =============================================
-- RLS for signed_documents (table already exists, just add policies if missing)
-- =============================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'signed_documents' AND policyname = 'Internal users can view signed documents') THEN
    CREATE POLICY "Internal users can view signed documents" ON public.signed_documents
      FOR SELECT TO authenticated USING (is_internal_user());
  END IF;
END $$;
