
-- 1. Timesheet Entries (daily line items)
CREATE TABLE public.timesheet_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  timesheet_id uuid NOT NULL REFERENCES public.timesheets(id) ON DELETE CASCADE,
  staff_id uuid NOT NULL REFERENCES public.staff_profiles(id) ON DELETE CASCADE,
  entry_date date NOT NULL,
  hours numeric NOT NULL DEFAULT 0,
  description text DEFAULT '',
  cost_center_id uuid REFERENCES public.cost_centers(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.timesheet_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage timesheet_entries" ON public.timesheet_entries FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 2. Staff Documents
CREATE TABLE public.staff_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL REFERENCES public.staff_profiles(id) ON DELETE CASCADE,
  document_type text NOT NULL DEFAULT 'other',
  file_name text NOT NULL,
  storage_path text NOT NULL,
  expiry_date date,
  uploaded_by_user_id uuid REFERENCES public.profiles(id),
  uploaded_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.staff_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage staff_documents" ON public.staff_documents FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3. HR Checklists (templates)
CREATE TABLE public.hr_checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ngo_id uuid REFERENCES public.ngos(id),
  checklist_type text NOT NULL DEFAULT 'onboarding',
  name text NOT NULL,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.hr_checklists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage hr_checklists" ON public.hr_checklists FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4. HR Checklist Assignments
CREATE TABLE public.hr_checklist_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL REFERENCES public.staff_profiles(id) ON DELETE CASCADE,
  checklist_id uuid NOT NULL REFERENCES public.hr_checklists(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  item_statuses jsonb NOT NULL DEFAULT '{}'::jsonb,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
ALTER TABLE public.hr_checklist_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage hr_checklist_assignments" ON public.hr_checklist_assignments FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5. Performance Reviews
CREATE TABLE public.performance_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL REFERENCES public.staff_profiles(id) ON DELETE CASCADE,
  ngo_id uuid REFERENCES public.ngos(id),
  reviewer_user_id uuid REFERENCES public.profiles(id),
  review_period_start date NOT NULL,
  review_period_end date NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  overall_rating integer,
  goals_met jsonb DEFAULT '[]'::jsonb,
  strengths text DEFAULT '',
  areas_for_improvement text DEFAULT '',
  reviewer_comments text DEFAULT '',
  staff_comments text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.performance_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage performance_reviews" ON public.performance_reviews FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 6. Staff Certifications
CREATE TABLE public.staff_certifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL REFERENCES public.staff_profiles(id) ON DELETE CASCADE,
  certification_name text NOT NULL,
  issuing_body text DEFAULT '',
  issue_date date,
  expiry_date date,
  status text NOT NULL DEFAULT 'active',
  document_path text,
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.staff_certifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage staff_certifications" ON public.staff_certifications FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 7. Pay Runs
CREATE TABLE public.pay_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ngo_id uuid NOT NULL REFERENCES public.ngos(id),
  pay_period_start date NOT NULL,
  pay_period_end date NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  total_gross numeric NOT NULL DEFAULT 0,
  total_net numeric NOT NULL DEFAULT 0,
  run_date date,
  notes text DEFAULT '',
  created_by_user_id uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pay_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage pay_runs" ON public.pay_runs FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 8. Pay Run Items
CREATE TABLE public.pay_run_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pay_run_id uuid NOT NULL REFERENCES public.pay_runs(id) ON DELETE CASCADE,
  staff_id uuid NOT NULL REFERENCES public.staff_profiles(id),
  regular_hours numeric NOT NULL DEFAULT 0,
  overtime_hours numeric NOT NULL DEFAULT 0,
  gross_pay numeric NOT NULL DEFAULT 0,
  deductions jsonb NOT NULL DEFAULT '{}'::jsonb,
  net_pay numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pay_run_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage pay_run_items" ON public.pay_run_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Validation triggers
CREATE OR REPLACE FUNCTION public.validate_checklist_type()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.checklist_type NOT IN ('onboarding', 'offboarding') THEN
    RAISE EXCEPTION 'Invalid checklist type: %', NEW.checklist_type;
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;$$;
CREATE TRIGGER trg_validate_checklist_type BEFORE INSERT OR UPDATE ON public.hr_checklists FOR EACH ROW EXECUTE FUNCTION public.validate_checklist_type();

CREATE OR REPLACE FUNCTION public.validate_checklist_assignment_status()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status NOT IN ('pending', 'in_progress', 'completed') THEN
    RAISE EXCEPTION 'Invalid assignment status: %', NEW.status;
  END IF;
  RETURN NEW;
END;$$;
CREATE TRIGGER trg_validate_checklist_assignment BEFORE INSERT OR UPDATE ON public.hr_checklist_assignments FOR EACH ROW EXECUTE FUNCTION public.validate_checklist_assignment_status();

CREATE OR REPLACE FUNCTION public.validate_review_status()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status NOT IN ('draft', 'submitted', 'acknowledged') THEN
    RAISE EXCEPTION 'Invalid review status: %', NEW.status;
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;$$;
CREATE TRIGGER trg_validate_review_status BEFORE INSERT OR UPDATE ON public.performance_reviews FOR EACH ROW EXECUTE FUNCTION public.validate_review_status();

CREATE OR REPLACE FUNCTION public.validate_cert_status()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status NOT IN ('active', 'expired', 'pending_renewal') THEN
    RAISE EXCEPTION 'Invalid certification status: %', NEW.status;
  END IF;
  RETURN NEW;
END;$$;
CREATE TRIGGER trg_validate_cert_status BEFORE INSERT OR UPDATE ON public.staff_certifications FOR EACH ROW EXECUTE FUNCTION public.validate_cert_status();

CREATE OR REPLACE FUNCTION public.validate_pay_run_status()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status NOT IN ('draft', 'processing', 'completed') THEN
    RAISE EXCEPTION 'Invalid pay run status: %', NEW.status;
  END IF;
  RETURN NEW;
END;$$;
CREATE TRIGGER trg_validate_pay_run_status BEFORE INSERT OR UPDATE ON public.pay_runs FOR EACH ROW EXECUTE FUNCTION public.validate_pay_run_status();

CREATE OR REPLACE FUNCTION public.validate_staff_doc_type()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.document_type NOT IN ('contract', 'id_copy', 'tax_form', 'certification', 'other') THEN
    RAISE EXCEPTION 'Invalid document type: %', NEW.document_type;
  END IF;
  RETURN NEW;
END;$$;
CREATE TRIGGER trg_validate_staff_doc_type BEFORE INSERT OR UPDATE ON public.staff_documents FOR EACH ROW EXECUTE FUNCTION public.validate_staff_doc_type();
