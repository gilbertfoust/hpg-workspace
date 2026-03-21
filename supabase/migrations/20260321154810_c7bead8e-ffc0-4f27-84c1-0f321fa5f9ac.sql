
-- 1A) Extend accounts table with new columns
ALTER TABLE public.accounts 
  ADD COLUMN IF NOT EXISTS account_description text,
  ADD COLUMN IF NOT EXISTS normal_balance text DEFAULT 'debit',
  ADD COLUMN IF NOT EXISTS financial_statement_type text DEFAULT 'balance_sheet',
  ADD COLUMN IF NOT EXISTS balance_sheet_section text,
  ADD COLUMN IF NOT EXISTS income_statement_section text,
  ADD COLUMN IF NOT EXISTS cash_flow_section text,
  ADD COLUMN IF NOT EXISTS is_contra_account boolean DEFAULT false;

-- 1B) Create opening_balances table
CREATE TABLE IF NOT EXISTS public.opening_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ngo_id uuid NOT NULL REFERENCES public.ngos(id) ON DELETE CASCADE,
  fiscal_period_id uuid NOT NULL REFERENCES public.fiscal_periods(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(ngo_id, fiscal_period_id, account_id)
);

ALTER TABLE public.opening_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Internal users can manage opening_balances"
  ON public.opening_balances FOR ALL TO authenticated
  USING (public.is_internal_user())
  WITH CHECK (public.is_internal_user());

-- 1C) Create bank_reconciliations table
CREATE TABLE IF NOT EXISTS public.bank_reconciliations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ngo_id uuid NOT NULL REFERENCES public.ngos(id) ON DELETE CASCADE,
  fiscal_period_id uuid NOT NULL REFERENCES public.fiscal_periods(id) ON DELETE CASCADE,
  bank_account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  starting_balance numeric NOT NULL DEFAULT 0,
  adjusted_balance numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bank_reconciliations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Internal users can manage bank_reconciliations"
  ON public.bank_reconciliations FOR ALL TO authenticated
  USING (public.is_internal_user())
  WITH CHECK (public.is_internal_user());

-- Validation trigger for bank_reconciliations
CREATE OR REPLACE FUNCTION public.validate_bank_reconciliation_status()
  RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status NOT IN ('draft', 'in_review', 'reconciled') THEN
    RAISE EXCEPTION 'Invalid bank reconciliation status: %', NEW.status;
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_bank_reconciliation
  BEFORE INSERT OR UPDATE ON public.bank_reconciliations
  FOR EACH ROW EXECUTE FUNCTION public.validate_bank_reconciliation_status();

-- 1D) Create bank_reconciliation_items table
CREATE TABLE IF NOT EXISTS public.bank_reconciliation_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reconciliation_id uuid NOT NULL REFERENCES public.bank_reconciliations(id) ON DELETE CASCADE,
  item_type text NOT NULL DEFAULT 'adjustment',
  item_date date NOT NULL DEFAULT CURRENT_DATE,
  description text NOT NULL DEFAULT '',
  amount numeric NOT NULL DEFAULT 0,
  linked_transaction_id uuid REFERENCES public.transactions(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bank_reconciliation_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Internal users can manage bank_reconciliation_items"
  ON public.bank_reconciliation_items FOR ALL TO authenticated
  USING (public.is_internal_user())
  WITH CHECK (public.is_internal_user());

-- Validation trigger for item_type
CREATE OR REPLACE FUNCTION public.validate_bank_recon_item_type()
  RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.item_type NOT IN ('deposit_in_transit', 'outstanding_check', 'deposit_not_recorded', 'transfer_not_recorded', 'adjustment') THEN
    RAISE EXCEPTION 'Invalid bank reconciliation item type: %', NEW.item_type;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_bank_recon_item
  BEFORE INSERT OR UPDATE ON public.bank_reconciliation_items
  FOR EACH ROW EXECUTE FUNCTION public.validate_bank_recon_item_type();

-- 1E) Create cash_flow_forecasts table
CREATE TABLE IF NOT EXISTS public.cash_flow_forecasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ngo_id uuid NOT NULL REFERENCES public.ngos(id) ON DELETE CASCADE,
  name text NOT NULL,
  start_month date NOT NULL,
  month_count int NOT NULL DEFAULT 6,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cash_flow_forecasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Internal users can manage cash_flow_forecasts"
  ON public.cash_flow_forecasts FOR ALL TO authenticated
  USING (public.is_internal_user())
  WITH CHECK (public.is_internal_user());

CREATE OR REPLACE FUNCTION public.validate_forecast_status()
  RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status NOT IN ('draft', 'active', 'archived') THEN
    RAISE EXCEPTION 'Invalid forecast status: %', NEW.status;
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_forecast_status
  BEFORE INSERT OR UPDATE ON public.cash_flow_forecasts
  FOR EACH ROW EXECUTE FUNCTION public.validate_forecast_status();

-- 1F) Create cash_flow_forecast_lines table
CREATE TABLE IF NOT EXISTS public.cash_flow_forecast_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  forecast_id uuid NOT NULL REFERENCES public.cash_flow_forecasts(id) ON DELETE CASCADE,
  line_type text NOT NULL DEFAULT 'receipt',
  category_label text NOT NULL DEFAULT '',
  month_index int NOT NULL DEFAULT 0,
  amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cash_flow_forecast_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Internal users can manage cash_flow_forecast_lines"
  ON public.cash_flow_forecast_lines FOR ALL TO authenticated
  USING (public.is_internal_user())
  WITH CHECK (public.is_internal_user());

CREATE OR REPLACE FUNCTION public.validate_forecast_line_type()
  RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.line_type NOT IN ('receipt', 'payment') THEN
    RAISE EXCEPTION 'Invalid forecast line type: %', NEW.line_type;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_forecast_line
  BEFORE INSERT OR UPDATE ON public.cash_flow_forecast_lines
  FOR EACH ROW EXECUTE FUNCTION public.validate_forecast_line_type();

-- 1G) Create period_comparisons table
CREATE TABLE IF NOT EXISTS public.period_comparisons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ngo_id uuid NOT NULL REFERENCES public.ngos(id) ON DELETE CASCADE,
  current_fiscal_period_id uuid NOT NULL REFERENCES public.fiscal_periods(id) ON DELETE CASCADE,
  previous_fiscal_period_id uuid NOT NULL REFERENCES public.fiscal_periods(id) ON DELETE CASCADE,
  comparison_type text NOT NULL DEFAULT 'summary',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.period_comparisons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Internal users can manage period_comparisons"
  ON public.period_comparisons FOR ALL TO authenticated
  USING (public.is_internal_user())
  WITH CHECK (public.is_internal_user());

CREATE OR REPLACE FUNCTION public.validate_comparison_type()
  RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.comparison_type NOT IN ('pnl', 'cash_flow', 'budget_vs_actual', 'summary') THEN
    RAISE EXCEPTION 'Invalid comparison type: %', NEW.comparison_type;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_comparison_type
  BEFORE INSERT OR UPDATE ON public.period_comparisons
  FOR EACH ROW EXECUTE FUNCTION public.validate_comparison_type();
