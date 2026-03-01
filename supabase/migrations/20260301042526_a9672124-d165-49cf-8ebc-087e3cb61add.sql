
-- Revenue Streams table
CREATE TABLE public.revenue_streams (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ngo_id uuid NOT NULL REFERENCES public.ngos(id),
  name text NOT NULL,
  stream_type text NOT NULL DEFAULT 'donation',
  source text,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  annual_target numeric DEFAULT 0,
  currency_code text DEFAULT 'USD',
  account_id uuid REFERENCES public.accounts(id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Recurring Donations table
CREATE TABLE public.recurring_donations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ngo_id uuid NOT NULL REFERENCES public.ngos(id),
  revenue_stream_id uuid REFERENCES public.revenue_streams(id),
  donor_name text NOT NULL,
  donor_email text,
  donor_org_id uuid REFERENCES public.crm_organizations(id),
  amount numeric NOT NULL DEFAULT 0,
  currency_code text DEFAULT 'USD',
  frequency text NOT NULL DEFAULT 'monthly',
  start_date date NOT NULL,
  end_date date,
  next_expected_date date,
  status text NOT NULL DEFAULT 'active',
  payment_method text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Revenue Recognition table
CREATE TABLE public.revenue_recognition (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ngo_id uuid NOT NULL REFERENCES public.ngos(id),
  revenue_stream_id uuid REFERENCES public.revenue_streams(id),
  fiscal_period_id uuid REFERENCES public.fiscal_periods(id),
  transaction_id uuid REFERENCES public.transactions(id),
  recognition_date date NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  deferred_amount numeric NOT NULL DEFAULT 0,
  recognition_type text NOT NULL DEFAULT 'immediate',
  description text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.revenue_streams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_donations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revenue_recognition ENABLE ROW LEVEL SECURITY;

-- RLS: revenue_streams
CREATE POLICY "View revenue streams" ON public.revenue_streams FOR SELECT USING (is_internal_user() OR has_ngo_access(ngo_id));
CREATE POLICY "Insert revenue streams" ON public.revenue_streams FOR INSERT WITH CHECK (is_internal_user() OR has_ngo_access(ngo_id));
CREATE POLICY "Update revenue streams" ON public.revenue_streams FOR UPDATE USING (is_internal_user() OR has_ngo_access(ngo_id));
CREATE POLICY "Delete revenue streams" ON public.revenue_streams FOR DELETE USING (is_super_admin());

-- RLS: recurring_donations
CREATE POLICY "View recurring donations" ON public.recurring_donations FOR SELECT USING (is_internal_user() OR has_ngo_access(ngo_id));
CREATE POLICY "Insert recurring donations" ON public.recurring_donations FOR INSERT WITH CHECK (is_internal_user() OR has_ngo_access(ngo_id));
CREATE POLICY "Update recurring donations" ON public.recurring_donations FOR UPDATE USING (is_internal_user() OR has_ngo_access(ngo_id));
CREATE POLICY "Delete recurring donations" ON public.recurring_donations FOR DELETE USING (is_super_admin());

-- RLS: revenue_recognition
CREATE POLICY "View revenue recognition" ON public.revenue_recognition FOR SELECT USING (is_internal_user() OR has_ngo_access(ngo_id));
CREATE POLICY "Insert revenue recognition" ON public.revenue_recognition FOR INSERT WITH CHECK (is_internal_user() OR has_ngo_access(ngo_id));
CREATE POLICY "Update revenue recognition" ON public.revenue_recognition FOR UPDATE USING (is_internal_user() OR has_ngo_access(ngo_id));
CREATE POLICY "Delete revenue recognition" ON public.revenue_recognition FOR DELETE USING (is_super_admin());

-- Validation triggers
CREATE OR REPLACE FUNCTION public.validate_revenue_stream()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.stream_type NOT IN ('donation', 'grant', 'earned_income', 'membership', 'investment', 'in_kind', 'government', 'other') THEN
    RAISE EXCEPTION 'Invalid stream type: %', NEW.stream_type;
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_revenue_stream_trigger
BEFORE INSERT OR UPDATE ON public.revenue_streams
FOR EACH ROW EXECUTE FUNCTION public.validate_revenue_stream();

CREATE OR REPLACE FUNCTION public.validate_recurring_donation()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.frequency NOT IN ('weekly', 'biweekly', 'monthly', 'quarterly', 'semi_annual', 'annual', 'one_time') THEN
    RAISE EXCEPTION 'Invalid frequency: %', NEW.frequency;
  END IF;
  IF NEW.status NOT IN ('active', 'paused', 'canceled', 'completed', 'failed') THEN
    RAISE EXCEPTION 'Invalid recurring donation status: %', NEW.status;
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_recurring_donation_trigger
BEFORE INSERT OR UPDATE ON public.recurring_donations
FOR EACH ROW EXECUTE FUNCTION public.validate_recurring_donation();

CREATE OR REPLACE FUNCTION public.validate_revenue_recognition()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.recognition_type NOT IN ('immediate', 'deferred', 'conditional', 'milestone', 'time_based') THEN
    RAISE EXCEPTION 'Invalid recognition type: %', NEW.recognition_type;
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_revenue_recognition_trigger
BEFORE INSERT OR UPDATE ON public.revenue_recognition
FOR EACH ROW EXECUTE FUNCTION public.validate_revenue_recognition();
