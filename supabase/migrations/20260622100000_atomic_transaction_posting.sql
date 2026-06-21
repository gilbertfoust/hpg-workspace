-- Phase 1: Atomic transaction posting for legacy NGO ledger and finance_* ledger.
-- Additive only. Does not drop or reset existing data.

-- ---------------------------------------------------------------------------
-- Legacy transactions: workflow columns
-- ---------------------------------------------------------------------------

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS source_module text,
  ADD COLUMN IF NOT EXISTS transaction_number text,
  ADD COLUMN IF NOT EXISTS posted_at timestamptz,
  ADD COLUMN IF NOT EXISTS posted_by_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS voided_at timestamptz,
  ADD COLUMN IF NOT EXISTS voided_by_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS void_reason text,
  ADD COLUMN IF NOT EXISTS reversal_of_transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL;

UPDATE public.transactions
SET status = CASE WHEN is_void THEN 'voided' ELSE 'posted' END
WHERE status IS NULL;

ALTER TABLE public.transactions
  ALTER COLUMN status SET DEFAULT 'draft',
  ALTER COLUMN status SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'transactions_status_check'
  ) THEN
    ALTER TABLE public.transactions
      ADD CONSTRAINT transactions_status_check
      CHECK (status IN ('draft', 'posted', 'voided', 'reversed'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_transactions_status ON public.transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_transaction_number ON public.transactions(transaction_number);

CREATE TABLE IF NOT EXISTS public.transaction_number_counters (
  ngo_id uuid PRIMARY KEY REFERENCES public.ngos(id) ON DELETE CASCADE,
  last_number bigint NOT NULL DEFAULT 0
);

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.can_post_ngo_transaction(_ngo_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_internal_user() OR public.has_ngo_access(_ngo_id);
$$;

CREATE OR REPLACE FUNCTION public.validate_balanced_journal_lines(_lines jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  line jsonb;
  line_count integer := 0;
  total_debit numeric(18, 2) := 0;
  total_credit numeric(18, 2) := 0;
  debit_amt numeric(18, 2);
  credit_amt numeric(18, 2);
BEGIN
  IF _lines IS NULL OR jsonb_typeof(_lines) <> 'array' THEN
    RETURN jsonb_build_object(
      'valid', false,
      'line_count', 0,
      'total_debit', 0,
      'total_credit', 0,
      'error', 'Journal lines must be a JSON array'
    );
  END IF;

  FOR line IN SELECT value FROM jsonb_array_elements(_lines)
  LOOP
    debit_amt := COALESCE((line->>'debit')::numeric, 0);
    credit_amt := COALESCE((line->>'credit')::numeric, 0);

    IF COALESCE(line->>'account_id', '') = '' THEN
      CONTINUE;
    END IF;

    IF debit_amt < 0 OR credit_amt < 0 THEN
      RETURN jsonb_build_object(
        'valid', false,
        'line_count', line_count,
        'total_debit', total_debit,
        'total_credit', total_credit,
        'error', 'Debit and credit amounts must be zero or positive'
      );
    END IF;

    IF debit_amt > 0 AND credit_amt > 0 THEN
      RETURN jsonb_build_object(
        'valid', false,
        'line_count', line_count,
        'total_debit', total_debit,
        'total_credit', total_credit,
        'error', 'A journal line cannot have both debit and credit amounts'
      );
    END IF;

    IF debit_amt = 0 AND credit_amt = 0 THEN
      CONTINUE;
    END IF;

    line_count := line_count + 1;
    total_debit := total_debit + debit_amt;
    total_credit := total_credit + credit_amt;
  END LOOP;

  IF line_count < 2 THEN
    RETURN jsonb_build_object(
      'valid', false,
      'line_count', line_count,
      'total_debit', total_debit,
      'total_credit', total_credit,
      'error', 'Journal entry must contain at least two lines'
    );
  END IF;

  IF total_debit <= 0 OR total_credit <= 0 THEN
    RETURN jsonb_build_object(
      'valid', false,
      'line_count', line_count,
      'total_debit', total_debit,
      'total_credit', total_credit,
      'error', 'Journal entry must include both debit and credit amounts'
    );
  END IF;

  IF round(total_debit, 2) <> round(total_credit, 2) THEN
    RETURN jsonb_build_object(
      'valid', false,
      'line_count', line_count,
      'total_debit', total_debit,
      'total_credit', total_credit,
      'error', format('Journal entry is out of balance. Debits=%s Credits=%s', total_debit, total_credit)
    );
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'line_count', line_count,
    'total_debit', total_debit,
    'total_credit', total_credit,
    'error', null
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_open_fiscal_period(
  _ngo_id uuid,
  _transaction_date date,
  _fiscal_period_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  resolved_id uuid;
BEGIN
  IF _fiscal_period_id IS NOT NULL THEN
    SELECT fp.id
    INTO resolved_id
    FROM public.fiscal_periods fp
    WHERE fp.id = _fiscal_period_id
      AND fp.ngo_id = _ngo_id
      AND _transaction_date >= fp.start_date
      AND _transaction_date <= fp.end_date
      AND NOT fp.is_locked;

    IF resolved_id IS NULL THEN
      RAISE EXCEPTION 'Fiscal period is missing, locked, or does not cover transaction date %', _transaction_date;
    END IF;

    RETURN resolved_id;
  END IF;

  SELECT fp.id
  INTO resolved_id
  FROM public.fiscal_periods fp
  WHERE fp.ngo_id = _ngo_id
    AND _transaction_date >= fp.start_date
    AND _transaction_date <= fp.end_date
    AND NOT fp.is_locked
  ORDER BY fp.start_date DESC
  LIMIT 1;

  IF resolved_id IS NULL THEN
    RAISE EXCEPTION 'No open fiscal period found for NGO on date %', _transaction_date;
  END IF;

  RETURN resolved_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_transaction_number(_ngo_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_num bigint;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.ngos WHERE id = _ngo_id) THEN
    RAISE EXCEPTION 'NGO not found';
  END IF;

  INSERT INTO public.transaction_number_counters (ngo_id, last_number)
  VALUES (_ngo_id, 1)
  ON CONFLICT (ngo_id) DO UPDATE
    SET last_number = public.transaction_number_counters.last_number + 1
  RETURNING last_number INTO next_num;

  RETURN 'TXN-' || to_char(CURRENT_DATE, 'YYYY') || '-' || lpad(next_num::text, 6, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.log_transaction_audit(
  _transaction_id uuid,
  _action_type text,
  _after_json jsonb DEFAULT '{}'::jsonb,
  _reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_log (
    actor_user_id,
    action_type,
    entity_type,
    entity_id,
    after_json,
    reason
  ) VALUES (
    auth.uid(),
    _action_type,
    'transaction',
    _transaction_id,
    _after_json,
    _reason
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_ngo_journal_accounts(
  _ngo_id uuid,
  _lines jsonb
)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  line jsonb;
  acct_id uuid;
  acct_active boolean;
BEGIN
  FOR line IN SELECT value FROM jsonb_array_elements(_lines)
  LOOP
    acct_id := NULLIF(line->>'account_id', '')::uuid;
    IF acct_id IS NULL THEN
      CONTINUE;
    END IF;

    SELECT a.is_active
    INTO acct_active
    FROM public.accounts a
    WHERE a.id = acct_id
      AND (a.ngo_id IS NULL OR a.ngo_id = _ngo_id);

    IF acct_active IS NULL THEN
      RAISE EXCEPTION 'Account % is not valid for this NGO', acct_id;
    END IF;

    IF NOT acct_active THEN
      RAISE EXCEPTION 'Account % is inactive and cannot be used for posting', acct_id;
    END IF;
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
-- Immutability guards for posted legacy transactions
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.guard_ngo_journal_entry_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  txn_status text;
  txn_id uuid;
BEGIN
  txn_id := COALESCE(NEW.transaction_id, OLD.transaction_id);

  SELECT status
  INTO txn_status
  FROM public.transactions
  WHERE id = txn_id;

  IF txn_status IN ('posted', 'voided', 'reversed') THEN
    RAISE EXCEPTION 'Cannot modify journal entries for transaction in status %', txn_status;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_ngo_journal_entry_mutation ON public.journal_entries;
CREATE TRIGGER trg_guard_ngo_journal_entry_mutation
  BEFORE INSERT OR UPDATE OR DELETE ON public.journal_entries
  FOR EACH ROW EXECUTE FUNCTION public.guard_ngo_journal_entry_mutation();

CREATE OR REPLACE FUNCTION public.guard_posted_ngo_transaction()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IN ('posted', 'voided', 'reversed') THEN
    IF NEW.status IS DISTINCT FROM OLD.status
       AND NOT (
         (OLD.status = 'posted' AND NEW.status IN ('voided', 'reversed'))
         OR (OLD.status = 'voided' AND NEW.status = 'voided')
       ) THEN
      RAISE EXCEPTION 'Posted transactions cannot be edited directly. Use void or reverse workflows.';
    END IF;

    IF NEW.ngo_id IS DISTINCT FROM OLD.ngo_id
       OR NEW.fiscal_period_id IS DISTINCT FROM OLD.fiscal_period_id
       OR NEW.transaction_date IS DISTINCT FROM OLD.transaction_date
       OR NEW.description IS DISTINCT FROM OLD.description
       OR NEW.reference_number IS DISTINCT FROM OLD.reference_number
       OR NEW.source_module IS DISTINCT FROM OLD.source_module
       OR NEW.transaction_number IS DISTINCT FROM OLD.transaction_number
       OR NEW.posted_at IS DISTINCT FROM OLD.posted_at
       OR NEW.posted_by_user_id IS DISTINCT FROM OLD.posted_by_user_id THEN
      IF NOT (OLD.status = 'posted' AND NEW.status IN ('voided', 'reversed')) THEN
        RAISE EXCEPTION 'Posted transactions cannot be edited directly.';
      END IF;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' AND OLD.status <> 'draft' THEN
    RAISE EXCEPTION 'Only draft transactions can be deleted.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_posted_ngo_transaction ON public.transactions;
CREATE TRIGGER trg_guard_posted_ngo_transaction
  BEFORE UPDATE OR DELETE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.guard_posted_ngo_transaction();

-- ---------------------------------------------------------------------------
-- Legacy RPC: save_draft_transaction
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.save_draft_transaction(
  _ngo_id uuid,
  _transaction_date date,
  _description text,
  _reference_number text DEFAULT NULL,
  _source_module text DEFAULT NULL,
  _fiscal_period_id uuid DEFAULT NULL,
  _journal_lines jsonb DEFAULT '[]'::jsonb,
  _transaction_id uuid DEFAULT NULL
)
RETURNS public.transactions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  txn public.transactions;
  line jsonb;
  line_no integer := 0;
  resolved_period_id uuid;
BEGIN
  IF NOT public.can_post_ngo_transaction(_ngo_id) THEN
    RAISE EXCEPTION 'Not authorized to save transactions for this NGO';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.ngos WHERE id = _ngo_id) THEN
    RAISE EXCEPTION 'NGO not found';
  END IF;

  IF _description IS NULL OR trim(_description) = '' THEN
    RAISE EXCEPTION 'Description is required';
  END IF;

  IF _fiscal_period_id IS NOT NULL THEN
    resolved_period_id := public.get_open_fiscal_period(_ngo_id, _transaction_date, _fiscal_period_id);
  END IF;

  IF _transaction_id IS NOT NULL THEN
    SELECT * INTO txn FROM public.transactions WHERE id = _transaction_id FOR UPDATE;
    IF txn.id IS NULL THEN
      RAISE EXCEPTION 'Transaction not found';
    END IF;
    IF txn.status <> 'draft' THEN
      RAISE EXCEPTION 'Only draft transactions can be edited';
    END IF;
    IF txn.ngo_id <> _ngo_id THEN
      RAISE EXCEPTION 'Transaction does not belong to this NGO';
    END IF;

    UPDATE public.transactions
    SET transaction_date = _transaction_date,
        description = trim(_description),
        reference_number = NULLIF(trim(_reference_number), ''),
        source_module = NULLIF(trim(_source_module), ''),
        fiscal_period_id = COALESCE(resolved_period_id, fiscal_period_id),
        updated_at = now()
  WHERE id = _transaction_id
    RETURNING * INTO txn;

    DELETE FROM public.journal_entries WHERE transaction_id = _transaction_id;
  ELSE
    INSERT INTO public.transactions (
      ngo_id,
      fiscal_period_id,
      transaction_date,
      description,
      reference_number,
      source_module,
      status,
      created_by_user_id
    ) VALUES (
      _ngo_id,
      resolved_period_id,
      _transaction_date,
      trim(_description),
      NULLIF(trim(_reference_number), ''),
      NULLIF(trim(_source_module), ''),
      'draft',
      auth.uid()
    )
    RETURNING * INTO txn;
  END IF;

  FOR line IN SELECT value FROM jsonb_array_elements(COALESCE(_journal_lines, '[]'::jsonb))
  LOOP
    IF COALESCE(line->>'account_id', '') = '' THEN
      CONTINUE;
    END IF;

    line_no := line_no + 1;
    INSERT INTO public.journal_entries (
      transaction_id,
      account_id,
      debit,
      credit,
      memo
    ) VALUES (
      txn.id,
      (line->>'account_id')::uuid,
      COALESCE((line->>'debit')::numeric, 0),
      COALESCE((line->>'credit')::numeric, 0),
      NULLIF(trim(line->>'memo'), '')
    );
  END LOOP;

  PERFORM public.log_transaction_audit(
    txn.id,
    CASE WHEN _transaction_id IS NULL THEN 'draft_created' ELSE 'draft_updated' END,
    jsonb_build_object(
      'status', txn.status,
      'line_count', line_no,
      'source_module', txn.source_module
    )
  );

  RETURN txn;
END;
$$;

-- ---------------------------------------------------------------------------
-- Legacy RPC: post_transaction (create + post atomically)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.post_transaction(
  _ngo_id uuid,
  _transaction_date date,
  _description text,
  _reference_number text DEFAULT NULL,
  _source_module text DEFAULT NULL,
  _fiscal_period_id uuid DEFAULT NULL,
  _journal_lines jsonb DEFAULT '[]'::jsonb,
  _source_document_ids jsonb DEFAULT NULL
)
RETURNS public.transactions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  txn public.transactions;
  balance jsonb;
  resolved_period_id uuid;
  line jsonb;
  line_no integer := 0;
  doc_id uuid;
BEGIN
  IF NOT public.can_post_ngo_transaction(_ngo_id) THEN
    RAISE EXCEPTION 'Not authorized to post transactions for this NGO';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.ngos WHERE id = _ngo_id) THEN
    RAISE EXCEPTION 'NGO not found';
  END IF;

  IF _description IS NULL OR trim(_description) = '' THEN
    RAISE EXCEPTION 'Description is required';
  END IF;

  balance := public.validate_balanced_journal_lines(_journal_lines);
  IF NOT (balance->>'valid')::boolean THEN
    RAISE EXCEPTION '%', balance->>'error';
  END IF;

  PERFORM public.validate_ngo_journal_accounts(_ngo_id, _journal_lines);

  resolved_period_id := public.get_open_fiscal_period(_ngo_id, _transaction_date, _fiscal_period_id);

  -- Insert as draft first so journal line inserts pass immutability guards, then post.
  INSERT INTO public.transactions (
    ngo_id,
    fiscal_period_id,
    transaction_date,
    description,
    reference_number,
    source_module,
    status,
    created_by_user_id
  ) VALUES (
    _ngo_id,
    resolved_period_id,
    _transaction_date,
    trim(_description),
    NULLIF(trim(_reference_number), ''),
    NULLIF(trim(_source_module), ''),
    'draft',
    auth.uid()
  )
  RETURNING * INTO txn;

  FOR line IN SELECT value FROM jsonb_array_elements(_journal_lines)
  LOOP
    IF COALESCE(line->>'account_id', '') = '' THEN
      CONTINUE;
    END IF;

    line_no := line_no + 1;
    INSERT INTO public.journal_entries (
      transaction_id,
      account_id,
      debit,
      credit,
      memo
    ) VALUES (
      txn.id,
      (line->>'account_id')::uuid,
      COALESCE((line->>'debit')::numeric, 0),
      COALESCE((line->>'credit')::numeric, 0),
      NULLIF(trim(line->>'memo'), '')
    );
  END LOOP;

  UPDATE public.transactions
  SET status = 'posted',
      transaction_number = public.generate_transaction_number(_ngo_id),
      posted_at = now(),
      posted_by_user_id = auth.uid(),
      updated_at = now()
  WHERE id = txn.id
  RETURNING * INTO txn;

  IF _source_document_ids IS NOT NULL AND jsonb_typeof(_source_document_ids) = 'array' THEN
    FOR doc_id IN
      SELECT NULLIF(value::text, '')::uuid
      FROM jsonb_array_elements_text(_source_document_ids)
      WHERE NULLIF(value::text, '') IS NOT NULL
    LOOP
      PERFORM public.log_transaction_audit(
        txn.id,
        'source_document_attached',
        jsonb_build_object('document_id', doc_id)
      );
    END LOOP;
  END IF;

  PERFORM public.log_transaction_audit(
    txn.id,
    'posted',
    jsonb_build_object(
      'transaction_number', txn.transaction_number,
      'total_debit', balance->>'total_debit',
      'total_credit', balance->>'total_credit',
      'line_count', balance->>'line_count',
      'source_module', txn.source_module
    )
  );

  RETURN txn;
END;
$$;

-- ---------------------------------------------------------------------------
-- Legacy RPC: post_draft_transaction
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.post_draft_transaction(_transaction_id uuid)
RETURNS public.transactions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  txn public.transactions;
  lines_json jsonb;
  balance jsonb;
  resolved_period_id uuid;
BEGIN
  SELECT * INTO txn FROM public.transactions WHERE id = _transaction_id FOR UPDATE;
  IF txn.id IS NULL THEN
    RAISE EXCEPTION 'Transaction not found';
  END IF;

  IF NOT public.can_post_ngo_transaction(txn.ngo_id) THEN
    RAISE EXCEPTION 'Not authorized to post transactions for this NGO';
  END IF;

  IF txn.status <> 'draft' THEN
    RAISE EXCEPTION 'Only draft transactions can be posted. Current status: %', txn.status;
  END IF;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'account_id', je.account_id,
      'debit', je.debit,
      'credit', je.credit,
      'memo', je.memo
    )
    ORDER BY je.created_at
  ), '[]'::jsonb)
  INTO lines_json
  FROM public.journal_entries je
  WHERE je.transaction_id = _transaction_id;

  balance := public.validate_balanced_journal_lines(lines_json);
  IF NOT (balance->>'valid')::boolean THEN
    RAISE EXCEPTION '%', balance->>'error';
  END IF;

  PERFORM public.validate_ngo_journal_accounts(txn.ngo_id, lines_json);

  resolved_period_id := public.get_open_fiscal_period(
    txn.ngo_id,
    txn.transaction_date,
    txn.fiscal_period_id
  );

  UPDATE public.transactions
  SET status = 'posted',
      fiscal_period_id = resolved_period_id,
      transaction_number = COALESCE(NULLIF(trim(transaction_number), ''), public.generate_transaction_number(txn.ngo_id)),
      posted_at = now(),
      posted_by_user_id = auth.uid(),
      updated_at = now()
  WHERE id = _transaction_id
  RETURNING * INTO txn;

  PERFORM public.log_transaction_audit(
    txn.id,
    'posted',
    jsonb_build_object(
      'transaction_number', txn.transaction_number,
      'total_debit', balance->>'total_debit',
      'total_credit', balance->>'total_credit',
      'line_count', balance->>'line_count'
    )
  );

  RETURN txn;
END;
$$;

-- ---------------------------------------------------------------------------
-- Legacy RPC: void_transaction
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.void_transaction(
  _transaction_id uuid,
  _reason text DEFAULT NULL
)
RETURNS public.transactions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  txn public.transactions;
  void_reason text;
BEGIN
  SELECT * INTO txn FROM public.transactions WHERE id = _transaction_id FOR UPDATE;
  IF txn.id IS NULL THEN
    RAISE EXCEPTION 'Transaction not found';
  END IF;

  IF NOT public.can_post_ngo_transaction(txn.ngo_id) THEN
    RAISE EXCEPTION 'Not authorized to void transactions for this NGO';
  END IF;

  IF txn.status <> 'posted' THEN
    RAISE EXCEPTION 'Only posted transactions can be voided. Current status: %', txn.status;
  END IF;

  void_reason := COALESCE(NULLIF(trim(_reason), ''), 'Voided by user');

  UPDATE public.transactions
  SET status = 'voided',
      is_void = true,
      voided_at = now(),
      voided_by_user_id = auth.uid(),
      void_reason = void_reason,
      updated_at = now()
  WHERE id = _transaction_id
  RETURNING * INTO txn;

  PERFORM public.log_transaction_audit(
    txn.id,
    'voided',
    jsonb_build_object('transaction_number', txn.transaction_number),
    void_reason
  );

  RETURN txn;
END;
$$;

-- ---------------------------------------------------------------------------
-- Legacy RPC: reverse_transaction
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.reverse_transaction(
  _transaction_id uuid,
  _reversal_date date DEFAULT CURRENT_DATE,
  _reason text DEFAULT NULL
)
RETURNS public.transactions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  original public.transactions;
  reversal public.transactions;
  lines_json jsonb;
  reversal_description text;
BEGIN
  SELECT * INTO original FROM public.transactions WHERE id = _transaction_id FOR UPDATE;
  IF original.id IS NULL THEN
    RAISE EXCEPTION 'Transaction not found';
  END IF;

  IF NOT public.can_post_ngo_transaction(original.ngo_id) THEN
    RAISE EXCEPTION 'Not authorized to reverse transactions for this NGO';
  END IF;

  IF original.status <> 'posted' THEN
    RAISE EXCEPTION 'Only posted transactions can be reversed. Current status: %', original.status;
  END IF;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'account_id', je.account_id,
      'debit', je.credit,
      'credit', je.debit,
      'memo', COALESCE(je.memo, 'Reversal')
    )
    ORDER BY je.created_at
  ), '[]'::jsonb)
  INTO lines_json
  FROM public.journal_entries je
  WHERE je.transaction_id = _transaction_id;

  reversal_description := COALESCE(
    NULLIF(trim(_reason), ''),
  'Reversal of ' || COALESCE(original.transaction_number, original.reference_number, original.id::text)
  );

  reversal := public.post_transaction(
    original.ngo_id,
    _reversal_date,
    reversal_description,
    original.reference_number,
    COALESCE(original.source_module, 'reversal'),
    original.fiscal_period_id,
    lines_json,
    NULL
  );

  UPDATE public.transactions
  SET reversal_of_transaction_id = original.id
  WHERE id = reversal.id;

  UPDATE public.transactions
  SET status = 'reversed',
      updated_at = now()
  WHERE id = original.id
  RETURNING * INTO original;

  PERFORM public.log_transaction_audit(
    original.id,
    'reversed',
    jsonb_build_object(
      'reversal_transaction_id', reversal.id,
      'reversal_transaction_number', reversal.transaction_number
    ),
    _reason
  );

  RETURN reversal;
END;
$$;

-- ---------------------------------------------------------------------------
-- Legacy RPC: delete_draft_transaction
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.delete_draft_transaction(_transaction_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  txn public.transactions;
BEGIN
  SELECT * INTO txn FROM public.transactions WHERE id = _transaction_id FOR UPDATE;
  IF txn.id IS NULL THEN
    RAISE EXCEPTION 'Transaction not found';
  END IF;

  IF NOT public.can_post_ngo_transaction(txn.ngo_id) THEN
    RAISE EXCEPTION 'Not authorized to delete transactions for this NGO';
  END IF;

  IF txn.status <> 'draft' THEN
    RAISE EXCEPTION 'Only draft transactions can be deleted';
  END IF;

  DELETE FROM public.transactions WHERE id = _transaction_id;

  PERFORM public.log_transaction_audit(
    _transaction_id,
    'draft_deleted',
    jsonb_build_object('ngo_id', txn.ngo_id)
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Finance RPC: save_finance_journal_entry (atomic draft save)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.validate_finance_journal_accounts(_lines jsonb)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  line jsonb;
  acct_id uuid;
  acct_active boolean;
BEGIN
  FOR line IN SELECT value FROM jsonb_array_elements(_lines)
  LOOP
    acct_id := NULLIF(line->>'account_id', '')::uuid;
    IF acct_id IS NULL THEN
      CONTINUE;
    END IF;

    SELECT fa.is_active
    INTO acct_active
    FROM public.finance_accounts fa
    WHERE fa.id = acct_id;

    IF acct_active IS NULL THEN
      RAISE EXCEPTION 'Finance account % not found', acct_id;
    END IF;

    IF NOT acct_active THEN
      RAISE EXCEPTION 'Finance account % is inactive and cannot be used for posting', acct_id;
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_finance_journal_entry(
  _entry_id uuid DEFAULT NULL,
  _entry_date date DEFAULT CURRENT_DATE,
  _memo text DEFAULT NULL,
  _source_type text DEFAULT NULL,
  _source_id uuid DEFAULT NULL,
  _lines jsonb DEFAULT '[]'::jsonb
)
RETURNS public.finance_journal_entries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  entry public.finance_journal_entries;
  line jsonb;
  line_no integer := 0;
BEGIN
  IF NOT public.is_finance_ledger_manager() THEN
    RAISE EXCEPTION 'Finance manager access required to save journal entries';
  END IF;

  IF _entry_id IS NOT NULL THEN
    SELECT * INTO entry FROM public.finance_journal_entries WHERE id = _entry_id FOR UPDATE;
    IF entry.id IS NULL THEN
      RAISE EXCEPTION 'Journal entry not found';
    END IF;
    IF entry.status <> 'draft' THEN
      RAISE EXCEPTION 'Only draft journal entries can be edited';
    END IF;

    UPDATE public.finance_journal_entries
    SET entry_date = _entry_date,
        memo = NULLIF(trim(_memo), ''),
        source_type = NULLIF(trim(_source_type), ''),
        source_id = _source_id,
        updated_at = now()
    WHERE id = _entry_id
    RETURNING * INTO entry;

    DELETE FROM public.finance_journal_lines WHERE journal_entry_id = _entry_id;
  ELSE
    INSERT INTO public.finance_journal_entries (
      entry_date,
      memo,
      source_type,
      source_id,
      status,
      created_by_user_id,
      entry_number
    ) VALUES (
      _entry_date,
      NULLIF(trim(_memo), ''),
      NULLIF(trim(_source_type), ''),
      _source_id,
      'draft',
      auth.uid(),
      ''
    )
    RETURNING * INTO entry;
  END IF;

  FOR line IN SELECT value FROM jsonb_array_elements(COALESCE(_lines, '[]'::jsonb))
  LOOP
    IF COALESCE(line->>'account_id', '') = '' THEN
      CONTINUE;
    END IF;

    line_no := line_no + 1;
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
    ) VALUES (
      entry.id,
      (line->>'account_id')::uuid,
      COALESCE((line->>'debit')::numeric, 0),
      COALESCE((line->>'credit')::numeric, 0),
      NULLIF(trim(line->>'memo'), ''),
      NULLIF(line->>'fund_id', '')::uuid,
      NULLIF(line->>'ngo_id', '')::uuid,
      NULLIF(line->>'department_id', '')::uuid,
      NULLIF(line->>'dimension_id', '')::uuid,
      NULLIF(line->>'document_id', '')::uuid,
      NULLIF(line->>'grant_application_id', '')::uuid,
      NULLIF(line->>'work_item_id', '')::uuid,
      COALESCE((line->>'line_number')::integer, line_no)
    );
  END LOOP;

  PERFORM public.finance_log_audit_event(
    'finance_journal_entry',
    entry.id,
    CASE WHEN _entry_id IS NULL THEN 'created' ELSE 'updated' END,
    jsonb_build_object('line_count', line_no)
  );

  RETURN entry;
END;
$$;

-- ---------------------------------------------------------------------------
-- Finance RPC: post_finance_journal_entry (enhanced with account validation)
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
  lines_json jsonb;
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

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'account_id', l.account_id,
      'debit', l.debit,
      'credit', l.credit,
      'memo', l.memo
    )
    ORDER BY l.line_number, l.created_at
  ), '[]'::jsonb)
  INTO lines_json
  FROM public.finance_journal_lines l
  WHERE l.journal_entry_id = _entry_id;

  PERFORM public.validate_finance_journal_accounts(lines_json);

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
-- Grants
-- ---------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.can_post_ngo_transaction(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.can_post_ngo_transaction(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.validate_balanced_journal_lines(jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.validate_balanced_journal_lines(jsonb) TO authenticated;

REVOKE ALL ON FUNCTION public.get_open_fiscal_period(uuid, date, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_open_fiscal_period(uuid, date, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.generate_transaction_number(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.generate_transaction_number(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.save_draft_transaction(uuid, date, text, text, text, uuid, jsonb, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.save_draft_transaction(uuid, date, text, text, text, uuid, jsonb, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.post_transaction(uuid, date, text, text, text, uuid, jsonb, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.post_transaction(uuid, date, text, text, text, uuid, jsonb, jsonb) TO authenticated;

REVOKE ALL ON FUNCTION public.post_draft_transaction(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.post_draft_transaction(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.void_transaction(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.void_transaction(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.reverse_transaction(uuid, date, text) FROM public;
GRANT EXECUTE ON FUNCTION public.reverse_transaction(uuid, date, text) TO authenticated;

REVOKE ALL ON FUNCTION public.delete_draft_transaction(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.delete_draft_transaction(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.validate_finance_journal_accounts(jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.validate_finance_journal_accounts(jsonb) TO authenticated;

REVOKE ALL ON FUNCTION public.save_finance_journal_entry(uuid, date, text, text, uuid, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.save_finance_journal_entry(uuid, date, text, text, uuid, jsonb) TO authenticated;
