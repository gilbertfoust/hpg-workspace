
-- Table for storing Make.com automation configurations
CREATE TABLE public.make_automations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  automation_type TEXT NOT NULL DEFAULT 'outbound',
  trigger_event TEXT NOT NULL,
  webhook_url TEXT,
  webhook_secret TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  config_json JSONB DEFAULT '{}'::jsonb,
  last_triggered_at TIMESTAMPTZ,
  trigger_count INTEGER NOT NULL DEFAULT 0,
  created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table for automation execution logs
CREATE TABLE public.make_automation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id UUID NOT NULL REFERENCES public.make_automations(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  request_payload JSONB,
  response_payload JSONB,
  error_message TEXT,
  triggered_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Validation triggers
CREATE OR REPLACE FUNCTION public.validate_automation_type()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.automation_type NOT IN ('outbound', 'inbound', 'bidirectional') THEN
    RAISE EXCEPTION 'Invalid automation_type: %', NEW.automation_type;
  END IF;
  IF NEW.trigger_event NOT IN (
    'esign.completed', 'esign.requested', 
    'document.uploaded', 'document.approved',
    'work_item.created', 'work_item.completed',
    'form.submitted', 'ngo.created',
    'transaction.created', 'intake.approved',
    'custom.webhook', 'manual.trigger'
  ) THEN
    RAISE EXCEPTION 'Invalid trigger_event: %', NEW.trigger_event;
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_automation
  BEFORE INSERT OR UPDATE ON public.make_automations
  FOR EACH ROW EXECUTE FUNCTION public.validate_automation_type();

CREATE OR REPLACE FUNCTION public.validate_automation_log_status()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status NOT IN ('pending', 'success', 'error', 'timeout') THEN
    RAISE EXCEPTION 'Invalid automation log status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_automation_log
  BEFORE INSERT OR UPDATE ON public.make_automation_logs
  FOR EACH ROW EXECUTE FUNCTION public.validate_automation_log_status();

-- RLS
ALTER TABLE public.make_automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.make_automation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Internal users can view automations"
  ON public.make_automations FOR SELECT TO authenticated
  USING (public.is_internal_user());

CREATE POLICY "Management can manage automations"
  ON public.make_automations FOR ALL TO authenticated
  USING (public.is_management())
  WITH CHECK (public.is_management());

CREATE POLICY "Internal users can view automation logs"
  ON public.make_automation_logs FOR SELECT TO authenticated
  USING (public.is_internal_user());

CREATE POLICY "Internal users can insert automation logs"
  ON public.make_automation_logs FOR INSERT TO authenticated
  WITH CHECK (public.is_internal_user());
