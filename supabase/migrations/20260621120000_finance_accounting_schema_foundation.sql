-- Phase 31: Finance Hub double-entry accounting schema foundation
-- HPG organization-wide ledger (separate from legacy accounts/transactions/journal_entries)

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public' AND t.typname = 'finance_account_type') THEN
    CREATE TYPE public.finance_account_type AS ENUM ('asset', 'liability', 'equity', 'revenue', 'expense');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public' AND t.typname = 'finance_normal_balance') THEN
    CREATE TYPE public.finance_normal_balance AS ENUM ('debit', 'credit');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public' AND t.typname = 'finance_fund_type') THEN
    CREATE TYPE public.finance_fund_type AS ENUM (
      'unrestricted',
      'donor_restricted',
      'board_designated',
      'grant_restricted',
      'fiscal_sponsorship',
      'pass_through'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public' AND t.typname = 'finance_journal_entry_status') THEN
    CREATE TYPE public.finance_journal_entry_status AS ENUM (
      'draft',
      'pending_approval',
      'posted',
      'voided',
      'reversed'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public' AND t.typname = 'finance_dimension_type') THEN
    CREATE TYPE public.finance_dimension_type AS ENUM (
      'project',
      'program',
      'department',
      'region',
      'campaign',
      'grant',
      'sponsored_ngo'
    );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Access helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_finance_ledger_manager()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'super_admin')
    OR public.has_role(auth.uid(), 'admin_pm')
    OR public.has_role(auth.uid(), 'vp_finance')
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('super_admin', 'admin_pm', 'vp_finance')
    );
$$;

CREATE OR REPLACE FUNCTION public.can_read_finance_ledger()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_finance_ledger_manager()
    OR (
      public.is_internal_user()
      AND NOT public.is_ngo_user()
    );
$$;

CREATE OR REPLACE FUNCTION public.finance_log_audit_event(
  _entity_type text,
  _entity_id uuid,
  _action text,
  _metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _event_id uuid;
BEGIN
  INSERT INTO public.finance_audit_events (
    entity_type,
    entity_id,
    action,
    actor_user_id,
    metadata_json
  ) VALUES (
    _entity_type,
    _entity_id,
    _action,
    auth.uid(),
    COALESCE(_metadata, '{}'::jsonb)
  )
  RETURNING id INTO _event_id;

  RETURN _event_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Core tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.finance_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  name text NOT NULL,
  account_type public.finance_account_type NOT NULL,
  account_subtype text,
  parent_account_id uuid REFERENCES public.finance_accounts(id) ON DELETE SET NULL,
  normal_balance public.finance_normal_balance NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT finance_accounts_code_unique UNIQUE (code),
  CONSTRAINT finance_accounts_name_not_empty CHECK (char_length(trim(name)) > 0),
  CONSTRAINT finance_accounts_code_not_empty CHECK (char_length(trim(code)) > 0)
);

CREATE TABLE IF NOT EXISTS public.finance_funds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  fund_type public.finance_fund_type NOT NULL,
  restriction_notes text,
  ngo_id uuid REFERENCES public.ngos(id) ON DELETE SET NULL,
  grant_opportunity_id uuid REFERENCES public.grant_opportunities(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT finance_funds_name_not_empty CHECK (char_length(trim(name)) > 0)
);

CREATE TABLE IF NOT EXISTS public.finance_dimensions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dimension_type public.finance_dimension_type NOT NULL,
  code text,
  name text NOT NULL,
  ngo_id uuid REFERENCES public.ngos(id) ON DELETE SET NULL,
  department_id uuid REFERENCES public.org_units(id) ON DELETE SET NULL,
  grant_application_id uuid REFERENCES public.grant_applications(id) ON DELETE SET NULL,
  parent_dimension_id uuid REFERENCES public.finance_dimensions(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT finance_dimensions_name_not_empty CHECK (char_length(trim(name)) > 0)
);

CREATE SEQUENCE IF NOT EXISTS public.finance_journal_entry_number_seq;

CREATE TABLE IF NOT EXISTS public.finance_journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_number text NOT NULL,
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  memo text,
  source_type text,
  source_id uuid,
  status public.finance_journal_entry_status NOT NULL DEFAULT 'draft',
  reversal_of_entry_id uuid REFERENCES public.finance_journal_entries(id) ON DELETE SET NULL,
  created_by_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_by_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  posted_at timestamptz,
  voided_at timestamptz,
  void_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT finance_journal_entries_entry_number_unique UNIQUE (entry_number)
);

CREATE TABLE IF NOT EXISTS public.finance_journal_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id uuid NOT NULL REFERENCES public.finance_journal_entries(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.finance_accounts(id) ON DELETE RESTRICT,
  debit numeric(18, 2) NOT NULL DEFAULT 0 CHECK (debit >= 0),
  credit numeric(18, 2) NOT NULL DEFAULT 0 CHECK (credit >= 0),
  memo text,
  fund_id uuid REFERENCES public.finance_funds(id) ON DELETE SET NULL,
  ngo_id uuid REFERENCES public.ngos(id) ON DELETE SET NULL,
  department_id uuid REFERENCES public.org_units(id) ON DELETE SET NULL,
  dimension_id uuid REFERENCES public.finance_dimensions(id) ON DELETE SET NULL,
  document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL,
  grant_application_id uuid REFERENCES public.grant_applications(id) ON DELETE SET NULL,
  work_item_id uuid REFERENCES public.work_items(id) ON DELETE SET NULL,
  line_number integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT finance_journal_lines_debit_credit_exclusive CHECK (
    NOT (debit > 0 AND credit > 0)
  ),
  CONSTRAINT finance_journal_lines_nonzero CHECK (debit > 0 OR credit > 0)
);

CREATE TABLE IF NOT EXISTS public.finance_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  action text NOT NULL,
  actor_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_finance_accounts_type ON public.finance_accounts(account_type);
CREATE INDEX IF NOT EXISTS idx_finance_accounts_parent ON public.finance_accounts(parent_account_id);
CREATE INDEX IF NOT EXISTS idx_finance_accounts_active ON public.finance_accounts(is_active);

CREATE INDEX IF NOT EXISTS idx_finance_funds_type ON public.finance_funds(fund_type);
CREATE INDEX IF NOT EXISTS idx_finance_funds_ngo ON public.finance_funds(ngo_id);

CREATE INDEX IF NOT EXISTS idx_finance_dimensions_type ON public.finance_dimensions(dimension_type);
CREATE INDEX IF NOT EXISTS idx_finance_dimensions_ngo ON public.finance_dimensions(ngo_id);

CREATE INDEX IF NOT EXISTS idx_finance_journal_entries_status ON public.finance_journal_entries(status);
CREATE INDEX IF NOT EXISTS idx_finance_journal_entries_entry_date ON public.finance_journal_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_finance_journal_entries_source ON public.finance_journal_entries(source_type, source_id);

CREATE INDEX IF NOT EXISTS idx_finance_journal_lines_entry ON public.finance_journal_lines(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_finance_journal_lines_account ON public.finance_journal_lines(account_id);
CREATE INDEX IF NOT EXISTS idx_finance_journal_lines_fund ON public.finance_journal_lines(fund_id);
CREATE INDEX IF NOT EXISTS idx_finance_journal_lines_ngo ON public.finance_journal_lines(ngo_id);

CREATE INDEX IF NOT EXISTS idx_finance_audit_events_entity ON public.finance_audit_events(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_finance_audit_events_created ON public.finance_audit_events(created_at DESC);

-- ---------------------------------------------------------------------------
-- Updated-at triggers
-- ---------------------------------------------------------------------------

DROP TRIGGER IF EXISTS trg_finance_accounts_updated_at ON public.finance_accounts;
CREATE TRIGGER trg_finance_accounts_updated_at
  BEFORE UPDATE ON public.finance_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_finance_funds_updated_at ON public.finance_funds;
CREATE TRIGGER trg_finance_funds_updated_at
  BEFORE UPDATE ON public.finance_funds
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_finance_dimensions_updated_at ON public.finance_dimensions;
CREATE TRIGGER trg_finance_dimensions_updated_at
  BEFORE UPDATE ON public.finance_dimensions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_finance_journal_entries_updated_at ON public.finance_journal_entries;
CREATE TRIGGER trg_finance_journal_entries_updated_at
  BEFORE UPDATE ON public.finance_journal_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_finance_journal_lines_updated_at ON public.finance_journal_lines;
CREATE TRIGGER trg_finance_journal_lines_updated_at
  BEFORE UPDATE ON public.finance_journal_lines
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- Immutability guards for posted journal data
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.finance_guard_journal_entry_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  current_status public.finance_journal_entry_status;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT status INTO current_status FROM public.finance_journal_entries WHERE id = OLD.journal_entry_id;
  ELSE
    SELECT status INTO current_status FROM public.finance_journal_entries WHERE id = COALESCE(NEW.journal_entry_id, OLD.journal_entry_id);
  END IF;

  IF current_status IN ('posted', 'voided', 'reversed') THEN
    RAISE EXCEPTION 'Cannot modify lines for journal entry in status %', current_status;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.finance_guard_posted_journal_entry()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IN ('posted', 'voided', 'reversed') THEN
    IF NEW.status IS DISTINCT FROM OLD.status
       AND NOT (
         (OLD.status = 'posted' AND NEW.status IN ('voided', 'reversed'))
       ) THEN
      RAISE EXCEPTION 'Posted journal entries cannot be edited directly. Use void or reverse workflows.';
    END IF;

    IF NEW.entry_date IS DISTINCT FROM OLD.entry_date
       OR NEW.memo IS DISTINCT FROM OLD.memo
       OR NEW.entry_number IS DISTINCT FROM OLD.entry_number
       OR NEW.source_type IS DISTINCT FROM OLD.source_type
       OR NEW.source_id IS DISTINCT FROM OLD.source_id
       OR NEW.reversal_of_entry_id IS DISTINCT FROM OLD.reversal_of_entry_id
       OR NEW.created_by_user_id IS DISTINCT FROM OLD.created_by_user_id
       OR NEW.approved_by_user_id IS DISTINCT FROM OLD.approved_by_user_id
       OR NEW.posted_at IS DISTINCT FROM OLD.posted_at THEN
      IF OLD.status = 'posted' AND NEW.status IN ('voided', 'reversed') THEN
        -- allow metadata fields set by void/reverse RPCs only through controlled paths
        NULL;
      ELSE
        RAISE EXCEPTION 'Posted journal entries cannot be edited directly.';
      END IF;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Journal entries cannot be hard-deleted. Void or reverse instead.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_finance_guard_posted_journal_entry ON public.finance_journal_entries;
CREATE TRIGGER trg_finance_guard_posted_journal_entry
  BEFORE UPDATE OR DELETE ON public.finance_journal_entries
  FOR EACH ROW EXECUTE FUNCTION public.finance_guard_posted_journal_entry();

DROP TRIGGER IF EXISTS trg_finance_guard_journal_line_mutation ON public.finance_journal_lines;
CREATE TRIGGER trg_finance_guard_journal_line_mutation
  BEFORE INSERT OR UPDATE OR DELETE ON public.finance_journal_lines
  FOR EACH ROW EXECUTE FUNCTION public.finance_guard_journal_entry_mutation();

-- ---------------------------------------------------------------------------
-- Entry number helper
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.finance_assign_journal_entry_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.entry_number IS NULL OR trim(NEW.entry_number) = '' THEN
    NEW.entry_number := 'JE-' || to_char(COALESCE(NEW.entry_date, CURRENT_DATE), 'YYYY') || '-' ||
      lpad(nextval('public.finance_journal_entry_number_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_finance_assign_journal_entry_number ON public.finance_journal_entries;
CREATE TRIGGER trg_finance_assign_journal_entry_number
  BEFORE INSERT ON public.finance_journal_entries
  FOR EACH ROW EXECUTE FUNCTION public.finance_assign_journal_entry_number();

-- ---------------------------------------------------------------------------
-- RPC: post_finance_journal_entry
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.post_finance_journal_entry(_entry_id uuid)
RETURNS public.finance_journal_entries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  entry public.finance_journal_entries;
  total_debit numeric(18, 2);
  total_credit numeric(18, 2);
  line_count integer;
BEGIN
  IF NOT public.is_finance_ledger_manager() THEN
    RAISE EXCEPTION 'Finance manager access required to post journal entries';
  END IF;

  SELECT * INTO entry FROM public.finance_journal_entries WHERE id = _entry_id FOR UPDATE;
  IF entry.id IS NULL THEN
    RAISE EXCEPTION 'Journal entry not found';
  END IF;

  IF entry.status NOT IN ('draft', 'pending_approval') THEN
    RAISE EXCEPTION 'Only draft or pending approval entries can be posted. Current status: %', entry.status;
  END IF;

  SELECT COUNT(*), COALESCE(SUM(debit), 0), COALESCE(SUM(credit), 0)
  INTO line_count, total_debit, total_credit
  FROM public.finance_journal_lines
  WHERE journal_entry_id = _entry_id;

  IF line_count < 2 THEN
    RAISE EXCEPTION 'Journal entry must contain at least two lines before posting';
  END IF;

  IF total_debit <= 0 OR total_credit <= 0 THEN
    RAISE EXCEPTION 'Journal entry must include both debit and credit amounts';
  END IF;

  IF round(total_debit, 2) <> round(total_credit, 2) THEN
    RAISE EXCEPTION 'Journal entry is out of balance. Debits=% Credits=%', total_debit, total_credit;
  END IF;

  UPDATE public.finance_journal_entries
  SET status = 'posted',
      posted_at = now(),
      approved_by_user_id = COALESCE(approved_by_user_id, auth.uid()),
      updated_at = now()
  WHERE id = _entry_id
  RETURNING * INTO entry;

  PERFORM public.finance_log_audit_event(
    'finance_journal_entry',
    entry.id,
    'posted',
    jsonb_build_object(
      'entry_number', entry.entry_number,
      'total_debit', total_debit,
      'total_credit', total_credit,
      'line_count', line_count
    )
  );

  RETURN entry;
END;
$$;

-- ---------------------------------------------------------------------------
-- RPC: void_finance_journal_entry
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.void_finance_journal_entry(_entry_id uuid, _reason text DEFAULT NULL)
RETURNS public.finance_journal_entries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  entry public.finance_journal_entries;
BEGIN
  IF NOT public.is_finance_ledger_manager() THEN
    RAISE EXCEPTION 'Finance manager access required to void journal entries';
  END IF;

  SELECT * INTO entry FROM public.finance_journal_entries WHERE id = _entry_id FOR UPDATE;
  IF entry.id IS NULL THEN
    RAISE EXCEPTION 'Journal entry not found';
  END IF;

  IF entry.status <> 'posted' THEN
    RAISE EXCEPTION 'Only posted journal entries can be voided. Current status: %', entry.status;
  END IF;

  UPDATE public.finance_journal_entries
  SET status = 'voided',
      voided_at = now(),
      void_reason = COALESCE(NULLIF(trim(_reason), ''), 'Voided by finance user'),
      updated_at = now()
  WHERE id = _entry_id
  RETURNING * INTO entry;

  PERFORM public.finance_log_audit_event(
    'finance_journal_entry',
    entry.id,
    'voided',
    jsonb_build_object(
      'entry_number', entry.entry_number,
      'reason', entry.void_reason
    )
  );

  RETURN entry;
END;
$$;

-- ---------------------------------------------------------------------------
-- RPC: reverse_finance_journal_entry
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.reverse_finance_journal_entry(
  _entry_id uuid,
  _reversal_date date DEFAULT CURRENT_DATE,
  _memo text DEFAULT NULL
)
RETURNS public.finance_journal_entries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  original public.finance_journal_entries;
  reversal public.finance_journal_entries;
  reversal_memo text;
BEGIN
  IF NOT public.is_finance_ledger_manager() THEN
    RAISE EXCEPTION 'Finance manager access required to reverse journal entries';
  END IF;

  SELECT * INTO original FROM public.finance_journal_entries WHERE id = _entry_id FOR UPDATE;
  IF original.id IS NULL THEN
    RAISE EXCEPTION 'Journal entry not found';
  END IF;

  IF original.status <> 'posted' THEN
    RAISE EXCEPTION 'Only posted journal entries can be reversed. Current status: %', original.status;
  END IF;

  reversal_memo := COALESCE(
    NULLIF(trim(_memo), ''),
    'Reversal of ' || original.entry_number
  );

  INSERT INTO public.finance_journal_entries (
    entry_date,
    memo,
    source_type,
    source_id,
    status,
    reversal_of_entry_id,
    created_by_user_id
  ) VALUES (
    _reversal_date,
    reversal_memo,
    'reversal',
    original.id,
    'draft',
    original.id,
    auth.uid()
  )
  RETURNING * INTO reversal;

  INSERT INTO public.finance_journal_lines (
    journal_entry_id,
    account_id,
    debit,
    credit,
    memo,
    fund_id,
    ngo_id,
    department_id,
    dimension_id,
    document_id,
    grant_application_id,
    work_item_id,
    line_number
  )
  SELECT
    reversal.id,
    l.account_id,
    l.credit,
    l.debit,
    COALESCE(l.memo, reversal_memo),
    l.fund_id,
    l.ngo_id,
    l.department_id,
    l.dimension_id,
    l.document_id,
    l.grant_application_id,
    l.work_item_id,
    l.line_number
  FROM public.finance_journal_lines l
  WHERE l.journal_entry_id = original.id
  ORDER BY l.line_number, l.created_at;

  reversal := public.post_finance_journal_entry(reversal.id);

  UPDATE public.finance_journal_entries
  SET status = 'reversed',
      updated_at = now()
  WHERE id = original.id
  RETURNING * INTO original;

  PERFORM public.finance_log_audit_event(
    'finance_journal_entry',
    original.id,
    'reversed',
    jsonb_build_object(
      'entry_number', original.entry_number,
      'reversal_entry_id', reversal.id,
      'reversal_entry_number', reversal.entry_number
    )
  );

  RETURN reversal;
END;
$$;

REVOKE ALL ON FUNCTION public.post_finance_journal_entry(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.post_finance_journal_entry(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.void_finance_journal_entry(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.void_finance_journal_entry(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.reverse_finance_journal_entry(uuid, date, text) FROM public;
GRANT EXECUTE ON FUNCTION public.reverse_finance_journal_entry(uuid, date, text) TO authenticated;

REVOKE ALL ON FUNCTION public.finance_log_audit_event(text, uuid, text, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.finance_log_audit_event(text, uuid, text, jsonb) TO authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

ALTER TABLE public.finance_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_funds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_dimensions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_journal_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_audit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "finance accounts read" ON public.finance_accounts;
CREATE POLICY "finance accounts read"
  ON public.finance_accounts FOR SELECT TO authenticated
  USING (public.can_read_finance_ledger());

DROP POLICY IF EXISTS "finance accounts manage" ON public.finance_accounts;
CREATE POLICY "finance accounts manage"
  ON public.finance_accounts FOR ALL TO authenticated
  USING (public.is_finance_ledger_manager())
  WITH CHECK (public.is_finance_ledger_manager());

DROP POLICY IF EXISTS "finance funds read" ON public.finance_funds;
CREATE POLICY "finance funds read"
  ON public.finance_funds FOR SELECT TO authenticated
  USING (public.can_read_finance_ledger());

DROP POLICY IF EXISTS "finance funds manage" ON public.finance_funds;
CREATE POLICY "finance funds manage"
  ON public.finance_funds FOR ALL TO authenticated
  USING (public.is_finance_ledger_manager())
  WITH CHECK (public.is_finance_ledger_manager());

DROP POLICY IF EXISTS "finance dimensions read" ON public.finance_dimensions;
CREATE POLICY "finance dimensions read"
  ON public.finance_dimensions FOR SELECT TO authenticated
  USING (public.can_read_finance_ledger());

DROP POLICY IF EXISTS "finance dimensions manage" ON public.finance_dimensions;
CREATE POLICY "finance dimensions manage"
  ON public.finance_dimensions FOR ALL TO authenticated
  USING (public.is_finance_ledger_manager())
  WITH CHECK (public.is_finance_ledger_manager());

DROP POLICY IF EXISTS "finance journal entries read" ON public.finance_journal_entries;
CREATE POLICY "finance journal entries read"
  ON public.finance_journal_entries FOR SELECT TO authenticated
  USING (public.can_read_finance_ledger());

DROP POLICY IF EXISTS "finance journal entries manage" ON public.finance_journal_entries;
CREATE POLICY "finance journal entries manage"
  ON public.finance_journal_entries FOR ALL TO authenticated
  USING (public.is_finance_ledger_manager())
  WITH CHECK (public.is_finance_ledger_manager());

DROP POLICY IF EXISTS "finance journal lines read" ON public.finance_journal_lines;
CREATE POLICY "finance journal lines read"
  ON public.finance_journal_lines FOR SELECT TO authenticated
  USING (public.can_read_finance_ledger());

DROP POLICY IF EXISTS "finance journal lines manage" ON public.finance_journal_lines;
CREATE POLICY "finance journal lines manage"
  ON public.finance_journal_lines FOR ALL TO authenticated
  USING (public.is_finance_ledger_manager())
  WITH CHECK (public.is_finance_ledger_manager());

DROP POLICY IF EXISTS "finance audit events read" ON public.finance_audit_events;
CREATE POLICY "finance audit events read"
  ON public.finance_audit_events FOR SELECT TO authenticated
  USING (public.can_read_finance_ledger());

DROP POLICY IF EXISTS "finance audit events insert" ON public.finance_audit_events;
CREATE POLICY "finance audit events insert"
  ON public.finance_audit_events FOR INSERT TO authenticated
  WITH CHECK (public.is_finance_ledger_manager() OR actor_user_id = auth.uid());
