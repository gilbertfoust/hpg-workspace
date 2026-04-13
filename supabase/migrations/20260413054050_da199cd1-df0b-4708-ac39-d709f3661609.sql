
-- Policy Registry table
CREATE TABLE public.policy_registry (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  policy_name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  owner_name TEXT,
  description TEXT,
  document_path TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  last_review_date DATE,
  next_review_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Validation trigger
CREATE OR REPLACE FUNCTION public.validate_policy_status()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = 'public'
AS $$
BEGIN
  IF NEW.status NOT IN ('draft', 'active', 'under_review', 'archived') THEN
    RAISE EXCEPTION 'Invalid policy status: %', NEW.status;
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_policy_status
  BEFORE INSERT OR UPDATE ON public.policy_registry
  FOR EACH ROW EXECUTE FUNCTION public.validate_policy_status();

-- RLS
ALTER TABLE public.policy_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view policies"
  ON public.policy_registry FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Management can insert policies"
  ON public.policy_registry FOR INSERT
  TO authenticated WITH CHECK (public.is_management());

CREATE POLICY "Management can update policies"
  ON public.policy_registry FOR UPDATE
  TO authenticated USING (public.is_management());

CREATE POLICY "Management can delete policies"
  ON public.policy_registry FOR DELETE
  TO authenticated USING (public.is_management());
