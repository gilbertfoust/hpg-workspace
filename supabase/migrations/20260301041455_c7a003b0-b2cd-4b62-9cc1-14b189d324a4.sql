
-- Staff Profiles: extended employee/volunteer records
CREATE TABLE public.staff_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ngo_id UUID REFERENCES public.ngos(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  department_id UUID REFERENCES public.org_units(id) ON DELETE SET NULL,
  job_title TEXT,
  employment_type TEXT NOT NULL DEFAULT 'full_time',
  start_date DATE,
  end_date DATE,
  status TEXT NOT NULL DEFAULT 'active',
  hourly_rate NUMERIC,
  annual_salary NUMERIC,
  pto_balance_hours NUMERIC NOT NULL DEFAULT 0,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Timesheets: weekly/biweekly time entries
CREATE TABLE public.timesheets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_id UUID NOT NULL REFERENCES public.staff_profiles(id) ON DELETE CASCADE,
  ngo_id UUID NOT NULL REFERENCES public.ngos(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_hours NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  submitted_at TIMESTAMPTZ,
  approved_by_user_id UUID REFERENCES public.profiles(id),
  approved_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- PTO Requests
CREATE TABLE public.pto_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_id UUID NOT NULL REFERENCES public.staff_profiles(id) ON DELETE CASCADE,
  ngo_id UUID NOT NULL REFERENCES public.ngos(id) ON DELETE CASCADE,
  leave_type TEXT NOT NULL DEFAULT 'vacation',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  hours_requested NUMERIC NOT NULL DEFAULT 8,
  status TEXT NOT NULL DEFAULT 'pending',
  approved_by_user_id UUID REFERENCES public.profiles(id),
  approved_at TIMESTAMPTZ,
  reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Validation triggers
CREATE OR REPLACE FUNCTION public.validate_staff_status()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status NOT IN ('active', 'inactive', 'on_leave', 'terminated') THEN
    RAISE EXCEPTION 'Invalid staff status: %', NEW.status;
  END IF;
  IF NEW.employment_type NOT IN ('full_time', 'part_time', 'contractor', 'volunteer', 'intern') THEN
    RAISE EXCEPTION 'Invalid employment type: %', NEW.employment_type;
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_validate_staff_status BEFORE INSERT OR UPDATE ON public.staff_profiles FOR EACH ROW EXECUTE FUNCTION public.validate_staff_status();

CREATE OR REPLACE FUNCTION public.validate_timesheet_status()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status NOT IN ('draft', 'submitted', 'approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid timesheet status: %', NEW.status;
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_validate_timesheet_status BEFORE INSERT OR UPDATE ON public.timesheets FOR EACH ROW EXECUTE FUNCTION public.validate_timesheet_status();

CREATE OR REPLACE FUNCTION public.validate_pto_request()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.leave_type NOT IN ('vacation', 'sick', 'personal', 'bereavement', 'parental', 'other') THEN
    RAISE EXCEPTION 'Invalid leave type: %', NEW.leave_type;
  END IF;
  IF NEW.status NOT IN ('pending', 'approved', 'rejected', 'canceled') THEN
    RAISE EXCEPTION 'Invalid PTO status: %', NEW.status;
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_validate_pto_request BEFORE INSERT OR UPDATE ON public.pto_requests FOR EACH ROW EXECUTE FUNCTION public.validate_pto_request();

-- RLS
ALTER TABLE public.staff_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timesheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pto_requests ENABLE ROW LEVEL SECURITY;

-- staff_profiles
CREATE POLICY "View staff profiles" ON public.staff_profiles FOR SELECT USING (is_internal_user() OR has_ngo_access(ngo_id));
CREATE POLICY "Insert staff profiles" ON public.staff_profiles FOR INSERT WITH CHECK (is_internal_user() OR has_ngo_access(ngo_id));
CREATE POLICY "Update staff profiles" ON public.staff_profiles FOR UPDATE USING (is_internal_user() OR has_ngo_access(ngo_id));
CREATE POLICY "Delete staff profiles" ON public.staff_profiles FOR DELETE USING (is_super_admin());

-- timesheets
CREATE POLICY "View timesheets" ON public.timesheets FOR SELECT USING (is_internal_user() OR has_ngo_access(ngo_id));
CREATE POLICY "Insert timesheets" ON public.timesheets FOR INSERT WITH CHECK (is_internal_user() OR has_ngo_access(ngo_id));
CREATE POLICY "Update timesheets" ON public.timesheets FOR UPDATE USING (is_internal_user() OR has_ngo_access(ngo_id));
CREATE POLICY "Delete timesheets" ON public.timesheets FOR DELETE USING (is_super_admin());

-- pto_requests
CREATE POLICY "View PTO requests" ON public.pto_requests FOR SELECT USING (is_internal_user() OR has_ngo_access(ngo_id));
CREATE POLICY "Insert PTO requests" ON public.pto_requests FOR INSERT WITH CHECK (is_internal_user() OR has_ngo_access(ngo_id));
CREATE POLICY "Update PTO requests" ON public.pto_requests FOR UPDATE USING (is_internal_user() OR has_ngo_access(ngo_id));
CREATE POLICY "Delete PTO requests" ON public.pto_requests FOR DELETE USING (is_super_admin());
