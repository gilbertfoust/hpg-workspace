
-- A) cost_centers
CREATE TABLE public.cost_centers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ngo_id uuid REFERENCES public.ngos(id),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  type text NOT NULL,
  parent_cost_center_id uuid REFERENCES public.cost_centers(id),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.validate_cost_center_type()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.type NOT IN ('ngo','department','program','grant','country_hub','admin','shared_service') THEN
    RAISE EXCEPTION 'Invalid cost center type: %', NEW.type;
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_cost_center_type BEFORE INSERT OR UPDATE ON public.cost_centers FOR EACH ROW EXECUTE FUNCTION public.validate_cost_center_type();

-- B) usage_sources
CREATE TABLE public.usage_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL,
  source_table text,
  source_reference_id uuid,
  description text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.validate_usage_source_type()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.type NOT IN ('staff_time','procurement','inventory','asset','subscription','travel','facility','contractor','other') THEN
    RAISE EXCEPTION 'Invalid usage source type: %', NEW.type;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_usage_source_type BEFORE INSERT OR UPDATE ON public.usage_sources FOR EACH ROW EXECUTE FUNCTION public.validate_usage_source_type();

-- C) usage_entries
CREATE TABLE public.usage_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ngo_id uuid REFERENCES public.ngos(id),
  fiscal_period_id uuid NOT NULL REFERENCES public.fiscal_periods(id),
  cost_center_id uuid NOT NULL REFERENCES public.cost_centers(id),
  usage_source_id uuid NOT NULL REFERENCES public.usage_sources(id),
  quantity numeric NOT NULL DEFAULT 0,
  unit_type text NOT NULL,
  unit_cost numeric NOT NULL DEFAULT 0,
  total_cost numeric NOT NULL DEFAULT 0,
  usage_date date NOT NULL,
  description text DEFAULT '',
  source_reference_type text,
  source_reference_id uuid,
  submitted_by_user_id uuid REFERENCES public.profiles(id),
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.validate_usage_entry()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.unit_type NOT IN ('hours','units','licenses','miles','days','amount','other') THEN
    RAISE EXCEPTION 'Invalid unit type: %', NEW.unit_type;
  END IF;
  IF NEW.status NOT IN ('draft','pending_review','approved','allocated') THEN
    RAISE EXCEPTION 'Invalid usage entry status: %', NEW.status;
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_usage_entry BEFORE INSERT OR UPDATE ON public.usage_entries FOR EACH ROW EXECUTE FUNCTION public.validate_usage_entry();

-- D) allocation_rules
CREATE TABLE public.allocation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  basis_type text NOT NULL,
  source_cost_center_id uuid REFERENCES public.cost_centers(id),
  target_scope_type text NOT NULL,
  rule_config_json jsonb DEFAULT '{}',
  offset_account_id uuid REFERENCES public.accounts(id),
  expense_account_id uuid REFERENCES public.accounts(id),
  effective_start_date date NOT NULL,
  effective_end_date date,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.validate_allocation_rule()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.basis_type NOT IN ('hours','headcount','units','flat_percent','transaction_count','revenue_share','square_footage','custom') THEN
    RAISE EXCEPTION 'Invalid allocation basis type: %', NEW.basis_type;
  END IF;
  IF NEW.target_scope_type NOT IN ('ngo','program','grant','department','country_hub') THEN
    RAISE EXCEPTION 'Invalid target scope type: %', NEW.target_scope_type;
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_allocation_rule BEFORE INSERT OR UPDATE ON public.allocation_rules FOR EACH ROW EXECUTE FUNCTION public.validate_allocation_rule();

-- E) allocation_runs
CREATE TABLE public.allocation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fiscal_period_id uuid NOT NULL REFERENCES public.fiscal_periods(id),
  name text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  notes text DEFAULT '',
  created_by_user_id uuid REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now(),
  posted_at timestamptz
);

CREATE OR REPLACE FUNCTION public.validate_allocation_run_status()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status NOT IN ('draft','preview','approved','posted','cancelled') THEN
    RAISE EXCEPTION 'Invalid allocation run status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_allocation_run_status BEFORE INSERT OR UPDATE ON public.allocation_runs FOR EACH ROW EXECUTE FUNCTION public.validate_allocation_run_status();

-- F) allocation_results
CREATE TABLE public.allocation_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  allocation_run_id uuid NOT NULL REFERENCES public.allocation_runs(id) ON DELETE CASCADE,
  allocation_rule_id uuid NOT NULL REFERENCES public.allocation_rules(id),
  source_usage_entry_id uuid NOT NULL REFERENCES public.usage_entries(id),
  source_cost_center_id uuid REFERENCES public.cost_centers(id),
  target_cost_center_id uuid NOT NULL REFERENCES public.cost_centers(id),
  allocated_amount numeric NOT NULL DEFAULT 0,
  journal_transaction_id uuid REFERENCES public.transactions(id),
  details_json jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- G) internal_charges
CREATE TABLE public.internal_charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_cost_center_id uuid NOT NULL REFERENCES public.cost_centers(id),
  to_cost_center_id uuid NOT NULL REFERENCES public.cost_centers(id),
  fiscal_period_id uuid NOT NULL REFERENCES public.fiscal_periods(id),
  description text DEFAULT '',
  amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  journal_transaction_id uuid REFERENCES public.transactions(id),
  created_at timestamptz DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.validate_internal_charge_status()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status NOT IN ('draft','approved','posted') THEN
    RAISE EXCEPTION 'Invalid internal charge status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_internal_charge_status BEFORE INSERT OR UPDATE ON public.internal_charges FOR EACH ROW EXECUTE FUNCTION public.validate_internal_charge_status();

-- H) grant_restriction_rules
CREATE TABLE public.grant_restriction_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grant_application_id uuid REFERENCES public.grant_applications(id),
  cost_center_id uuid REFERENCES public.cost_centers(id),
  allowed_account_ids_json jsonb DEFAULT '[]',
  restricted_categories_json jsonb DEFAULT '[]',
  notes text DEFAULT '',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX idx_usage_entries_period ON public.usage_entries(fiscal_period_id);
CREATE INDEX idx_usage_entries_cost_center ON public.usage_entries(cost_center_id);
CREATE INDEX idx_usage_entries_status ON public.usage_entries(status);
CREATE INDEX idx_allocation_results_run ON public.allocation_results(allocation_run_id);
CREATE INDEX idx_internal_charges_period ON public.internal_charges(fiscal_period_id);
CREATE INDEX idx_cost_centers_type ON public.cost_centers(type);

-- RLS
ALTER TABLE public.cost_centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.allocation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.allocation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.allocation_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grant_restriction_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Internal users full access" ON public.cost_centers FOR ALL TO authenticated USING (public.is_internal_user()) WITH CHECK (public.is_internal_user());
CREATE POLICY "Internal users full access" ON public.usage_sources FOR ALL TO authenticated USING (public.is_internal_user()) WITH CHECK (public.is_internal_user());
CREATE POLICY "Internal users full access" ON public.usage_entries FOR ALL TO authenticated USING (public.is_internal_user()) WITH CHECK (public.is_internal_user());
CREATE POLICY "Internal users full access" ON public.allocation_rules FOR ALL TO authenticated USING (public.is_internal_user()) WITH CHECK (public.is_internal_user());
CREATE POLICY "Internal users full access" ON public.allocation_runs FOR ALL TO authenticated USING (public.is_internal_user()) WITH CHECK (public.is_internal_user());
CREATE POLICY "Internal users full access" ON public.allocation_results FOR ALL TO authenticated USING (public.is_internal_user()) WITH CHECK (public.is_internal_user());
CREATE POLICY "Internal users full access" ON public.internal_charges FOR ALL TO authenticated USING (public.is_internal_user()) WITH CHECK (public.is_internal_user());
CREATE POLICY "Internal users full access" ON public.grant_restriction_rules FOR ALL TO authenticated USING (public.is_internal_user()) WITH CHECK (public.is_internal_user());
