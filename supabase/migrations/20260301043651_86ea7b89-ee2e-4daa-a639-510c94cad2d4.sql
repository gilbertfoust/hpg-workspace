
-- NGO Risk Profiles
CREATE TABLE public.ngo_risk_profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ngo_id uuid NOT NULL REFERENCES public.ngos(id) UNIQUE,
  financial_risk_score integer NOT NULL DEFAULT 50,
  compliance_risk_score integer NOT NULL DEFAULT 50,
  hr_risk_score integer NOT NULL DEFAULT 50,
  operations_risk_score integer NOT NULL DEFAULT 50,
  overall_risk_score integer NOT NULL DEFAULT 50,
  risk_level text NOT NULL DEFAULT 'medium',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Controller Alerts
CREATE TABLE public.controller_alerts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ngo_id uuid REFERENCES public.ngos(id),
  module text NOT NULL,
  severity text NOT NULL DEFAULT 'info',
  message text NOT NULL,
  context_json jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

-- Enable RLS
ALTER TABLE public.ngo_risk_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.controller_alerts ENABLE ROW LEVEL SECURITY;

-- RLS: ngo_risk_profiles
CREATE POLICY "View risk profiles" ON public.ngo_risk_profiles FOR SELECT USING (is_internal_user());
CREATE POLICY "Insert risk profiles" ON public.ngo_risk_profiles FOR INSERT WITH CHECK (is_internal_user());
CREATE POLICY "Update risk profiles" ON public.ngo_risk_profiles FOR UPDATE USING (is_internal_user());
CREATE POLICY "Delete risk profiles" ON public.ngo_risk_profiles FOR DELETE USING (is_super_admin());

-- RLS: controller_alerts
CREATE POLICY "View controller alerts" ON public.controller_alerts FOR SELECT USING (is_internal_user());
CREATE POLICY "Insert controller alerts" ON public.controller_alerts FOR INSERT WITH CHECK (is_internal_user());
CREATE POLICY "Update controller alerts" ON public.controller_alerts FOR UPDATE USING (is_internal_user());
CREATE POLICY "Delete controller alerts" ON public.controller_alerts FOR DELETE USING (is_super_admin());

-- Validation: ngo_risk_profiles
CREATE OR REPLACE FUNCTION public.validate_risk_profile()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.risk_level NOT IN ('low', 'medium', 'high') THEN
    RAISE EXCEPTION 'Invalid risk level: %', NEW.risk_level;
  END IF;
  IF NEW.financial_risk_score < 0 OR NEW.financial_risk_score > 100 THEN
    RAISE EXCEPTION 'financial_risk_score must be 0-100';
  END IF;
  IF NEW.compliance_risk_score < 0 OR NEW.compliance_risk_score > 100 THEN
    RAISE EXCEPTION 'compliance_risk_score must be 0-100';
  END IF;
  IF NEW.hr_risk_score < 0 OR NEW.hr_risk_score > 100 THEN
    RAISE EXCEPTION 'hr_risk_score must be 0-100';
  END IF;
  IF NEW.operations_risk_score < 0 OR NEW.operations_risk_score > 100 THEN
    RAISE EXCEPTION 'operations_risk_score must be 0-100';
  END IF;
  IF NEW.overall_risk_score < 0 OR NEW.overall_risk_score > 100 THEN
    RAISE EXCEPTION 'overall_risk_score must be 0-100';
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_risk_profile_trigger
BEFORE INSERT OR UPDATE ON public.ngo_risk_profiles
FOR EACH ROW EXECUTE FUNCTION public.validate_risk_profile();

-- Validation: controller_alerts
CREATE OR REPLACE FUNCTION public.validate_controller_alert()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.module NOT IN ('finance', 'grants', 'procurement', 'hr', 'assets', 'inventory', 'compliance', 'system') THEN
    RAISE EXCEPTION 'Invalid alert module: %', NEW.module;
  END IF;
  IF NEW.severity NOT IN ('info', 'warning', 'critical') THEN
    RAISE EXCEPTION 'Invalid alert severity: %', NEW.severity;
  END IF;
  IF NEW.status NOT IN ('open', 'in_progress', 'resolved', 'dismissed') THEN
    RAISE EXCEPTION 'Invalid alert status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_controller_alert_trigger
BEFORE INSERT OR UPDATE ON public.controller_alerts
FOR EACH ROW EXECUTE FUNCTION public.validate_controller_alert();
