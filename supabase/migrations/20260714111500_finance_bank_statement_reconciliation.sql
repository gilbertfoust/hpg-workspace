-- NGO-scoped bank/card feeds, transaction matching, and evidence-based reconciliation.

-- ---------------------------------------------------------------------------
-- Bank register entity scope
-- ---------------------------------------------------------------------------

ALTER TABLE public.finance_bank_accounts
  ADD COLUMN IF NOT EXISTS ngo_id uuid REFERENCES public.ngos(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS account_kind text NOT NULL DEFAULT 'bank';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.finance_bank_accounts WHERE ngo_id IS NULL) THEN
    RAISE EXCEPTION 'Map existing finance_bank_accounts to an NGO before applying bank statement reconciliation';
  END IF;
END $$;

ALTER TABLE public.finance_bank_accounts
  ALTER COLUMN ngo_id SET NOT NULL,
  DROP CONSTRAINT IF EXISTS finance_bank_accounts_account_kind_check;
ALTER TABLE public.finance_bank_accounts
  ADD CONSTRAINT finance_bank_accounts_account_kind_check
  CHECK (account_kind IN ('bank', 'credit_card', 'cash'));

CREATE INDEX IF NOT EXISTS idx_finance_bank_accounts_ngo
  ON public.finance_bank_accounts(ngo_id, is_active);
CREATE UNIQUE INDEX IF NOT EXISTS idx_finance_bank_accounts_ngo_gl_unique
  ON public.finance_bank_accounts(ngo_id, linked_finance_account_id);

CREATE OR REPLACE FUNCTION public.finance_validate_bank_account()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  linked_account public.finance_accounts;
BEGIN
  IF NEW.ngo_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.ngos WHERE id = NEW.ngo_id) THEN
    RAISE EXCEPTION 'Bank or card account must belong to an NGO';
  END IF;
  SELECT * INTO linked_account FROM public.finance_accounts
  WHERE id = NEW.linked_finance_account_id AND is_active = true;
  IF linked_account.id IS NULL THEN RAISE EXCEPTION 'Linked GL account must be active'; END IF;
  IF NEW.account_kind = 'credit_card' AND linked_account.account_type <> 'liability' THEN
    RAISE EXCEPTION 'Credit card registers must link to a liability GL account';
  END IF;
  IF NEW.account_kind IN ('bank', 'cash') AND linked_account.account_type <> 'asset' THEN
    RAISE EXCEPTION 'Bank and cash registers must link to an asset GL account';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_finance_validate_bank_account ON public.finance_bank_accounts;
CREATE TRIGGER trg_finance_validate_bank_account
  BEFORE INSERT OR UPDATE ON public.finance_bank_accounts
  FOR EACH ROW EXECUTE FUNCTION public.finance_validate_bank_account();

ALTER TABLE public.finance_bank_reconciliations
  ADD COLUMN IF NOT EXISTS ngo_id uuid REFERENCES public.ngos(id) ON DELETE RESTRICT;

UPDATE public.finance_bank_reconciliations reconciliation
SET ngo_id = bank.ngo_id
FROM public.finance_bank_accounts bank
WHERE reconciliation.bank_account_id = bank.id
  AND reconciliation.ngo_id IS NULL;

ALTER TABLE public.finance_bank_reconciliations
  ALTER COLUMN ngo_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_finance_bank_reconciliations_ngo
  ON public.finance_bank_reconciliations(ngo_id, statement_end_date DESC);

CREATE OR REPLACE FUNCTION public.finance_validate_reconciliation_scope()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.finance_bank_accounts bank
    WHERE bank.id = NEW.bank_account_id AND bank.ngo_id = NEW.ngo_id
  ) THEN
    RAISE EXCEPTION 'Reconciliation bank account belongs to another NGO';
  END IF;
  IF NEW.statement_end_date < NEW.statement_start_date THEN
    RAISE EXCEPTION 'Statement end date cannot precede its start date';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_finance_validate_reconciliation_scope ON public.finance_bank_reconciliations;
CREATE TRIGGER trg_finance_validate_reconciliation_scope
  BEFORE INSERT OR UPDATE OF ngo_id, bank_account_id, statement_start_date, statement_end_date
  ON public.finance_bank_reconciliations
  FOR EACH ROW EXECUTE FUNCTION public.finance_validate_reconciliation_scope();

-- ---------------------------------------------------------------------------
-- Statement imports and normalized bank/card transactions
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.finance_bank_statement_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ngo_id uuid NOT NULL REFERENCES public.ngos(id) ON DELETE RESTRICT,
  bank_account_id uuid NOT NULL REFERENCES public.finance_bank_accounts(id) ON DELETE RESTRICT,
  document_id uuid NOT NULL UNIQUE REFERENCES public.documents(id) ON DELETE RESTRICT,
  content_sha256 text NOT NULL,
  file_name text NOT NULL,
  statement_start_date date NOT NULL,
  statement_end_date date NOT NULL,
  beginning_balance numeric(18, 2) NOT NULL,
  ending_balance numeric(18, 2) NOT NULL,
  transaction_total numeric(18, 2) NOT NULL DEFAULT 0,
  statement_variance numeric(18, 2) NOT NULL DEFAULT 0,
  row_count integer NOT NULL DEFAULT 0 CHECK (row_count >= 0),
  status text NOT NULL DEFAULT 'matching'
    CHECK (status IN ('matching', 'reconciling', 'reconciled', 'voided')),
  imported_by_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT DEFAULT auth.uid(),
  imported_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT finance_bank_statement_imports_hash_format CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT finance_bank_statement_imports_dates CHECK (statement_end_date >= statement_start_date),
  CONSTRAINT finance_bank_statement_imports_bank_hash_unique UNIQUE (bank_account_id, content_sha256)
);

CREATE TABLE IF NOT EXISTS public.finance_bank_statement_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id uuid NOT NULL REFERENCES public.finance_bank_statement_imports(id) ON DELETE CASCADE,
  ngo_id uuid NOT NULL REFERENCES public.ngos(id) ON DELETE RESTRICT,
  bank_account_id uuid NOT NULL REFERENCES public.finance_bank_accounts(id) ON DELETE RESTRICT,
  row_number integer NOT NULL CHECK (row_number > 0),
  source_transaction_id text,
  transaction_date date NOT NULL,
  posted_date date,
  description text NOT NULL,
  amount numeric(18, 2) NOT NULL CHECK (amount <> 0),
  currency text NOT NULL DEFAULT 'USD',
  reference_number text,
  transaction_fingerprint text NOT NULL,
  raw_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  match_status text NOT NULL DEFAULT 'unmatched'
    CHECK (match_status IN ('unmatched', 'suggested', 'matched', 'ignored', 'reconciled')),
  suggested_journal_line_id uuid REFERENCES public.finance_journal_lines(id) ON DELETE SET NULL,
  matched_journal_line_id uuid REFERENCES public.finance_journal_lines(id) ON DELETE RESTRICT,
  match_confidence numeric(5, 4) CHECK (match_confidence IS NULL OR (match_confidence >= 0 AND match_confidence <= 1)),
  matched_by_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  matched_at timestamptz,
  ignore_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT finance_bank_statement_transactions_import_row_unique UNIQUE (import_id, row_number),
  CONSTRAINT finance_bank_statement_transactions_fingerprint_format CHECK (transaction_fingerprint ~ '^[0-9a-f]{64}$')
);

CREATE INDEX IF NOT EXISTS idx_finance_bank_statement_imports_ngo_status
  ON public.finance_bank_statement_imports(ngo_id, status, statement_end_date DESC);
CREATE INDEX IF NOT EXISTS idx_finance_bank_statement_imports_bank
  ON public.finance_bank_statement_imports(bank_account_id, statement_end_date DESC);
CREATE INDEX IF NOT EXISTS idx_finance_bank_statement_imports_imported_by
  ON public.finance_bank_statement_imports(imported_by_user_id);
CREATE INDEX IF NOT EXISTS idx_finance_bank_statement_transactions_import_status
  ON public.finance_bank_statement_transactions(import_id, match_status, transaction_date);
CREATE INDEX IF NOT EXISTS idx_finance_bank_statement_transactions_ngo
  ON public.finance_bank_statement_transactions(ngo_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_finance_bank_statement_transactions_bank_fingerprint
  ON public.finance_bank_statement_transactions(bank_account_id, transaction_fingerprint);
CREATE INDEX IF NOT EXISTS idx_finance_bank_statement_transactions_suggested_line
  ON public.finance_bank_statement_transactions(suggested_journal_line_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_finance_bank_statement_transactions_matched_line_unique
  ON public.finance_bank_statement_transactions(matched_journal_line_id)
  WHERE matched_journal_line_id IS NOT NULL
    AND match_status IN ('matched', 'reconciled');

DROP TRIGGER IF EXISTS trg_finance_bank_statement_imports_updated_at ON public.finance_bank_statement_imports;
CREATE TRIGGER trg_finance_bank_statement_imports_updated_at
  BEFORE UPDATE ON public.finance_bank_statement_imports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_finance_bank_statement_transactions_updated_at ON public.finance_bank_statement_transactions;
CREATE TRIGGER trg_finance_bank_statement_transactions_updated_at
  BEFORE UPDATE ON public.finance_bank_statement_transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.finance_bank_statement_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_bank_statement_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "finance bank statement imports read"
  ON public.finance_bank_statement_imports FOR SELECT TO authenticated
  USING (public.can_read_finance_ledger());
CREATE POLICY "finance bank statement imports insert"
  ON public.finance_bank_statement_imports FOR INSERT TO authenticated
  WITH CHECK (public.is_finance_ledger_manager());
CREATE POLICY "finance bank statement imports update"
  ON public.finance_bank_statement_imports FOR UPDATE TO authenticated
  USING (public.is_finance_ledger_manager()) WITH CHECK (public.is_finance_ledger_manager());
CREATE POLICY "finance bank statement imports delete"
  ON public.finance_bank_statement_imports FOR DELETE TO authenticated
  USING (public.is_finance_ledger_manager());

CREATE POLICY "finance bank statement transactions read"
  ON public.finance_bank_statement_transactions FOR SELECT TO authenticated
  USING (public.can_read_finance_ledger());
CREATE POLICY "finance bank statement transactions insert"
  ON public.finance_bank_statement_transactions FOR INSERT TO authenticated
  WITH CHECK (public.is_finance_ledger_manager());
CREATE POLICY "finance bank statement transactions update"
  ON public.finance_bank_statement_transactions FOR UPDATE TO authenticated
  USING (public.is_finance_ledger_manager()) WITH CHECK (public.is_finance_ledger_manager());
CREATE POLICY "finance bank statement transactions delete"
  ON public.finance_bank_statement_transactions FOR DELETE TO authenticated
  USING (public.is_finance_ledger_manager());

-- Reconciliation evidence links.
ALTER TABLE public.finance_bank_reconciliations
  ADD COLUMN IF NOT EXISTS statement_import_id uuid UNIQUE
    REFERENCES public.finance_bank_statement_imports(id) ON DELETE RESTRICT;
ALTER TABLE public.finance_bank_reconciliation_items
  ADD COLUMN IF NOT EXISTS statement_transaction_id uuid
    REFERENCES public.finance_bank_statement_transactions(id) ON DELETE RESTRICT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_finance_bank_recon_items_line_unique
  ON public.finance_bank_reconciliation_items(reconciliation_id, journal_line_id)
  WHERE journal_line_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_finance_bank_recon_items_statement_tx_unique
  ON public.finance_bank_reconciliation_items(reconciliation_id, statement_transaction_id)
  WHERE statement_transaction_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_finance_bank_recon_items_statement_tx
  ON public.finance_bank_reconciliation_items(statement_transaction_id);
CREATE INDEX IF NOT EXISTS idx_finance_bank_reconciliations_statement_import
  ON public.finance_bank_reconciliations(statement_import_id);

-- Avoid overlapping SELECT policies while keeping authenticated Finance writes.
DROP POLICY IF EXISTS "finance bank accounts manage" ON public.finance_bank_accounts;
CREATE POLICY "finance bank accounts insert" ON public.finance_bank_accounts
  FOR INSERT TO authenticated WITH CHECK (public.is_finance_ledger_manager());
CREATE POLICY "finance bank accounts update" ON public.finance_bank_accounts
  FOR UPDATE TO authenticated USING (public.is_finance_ledger_manager()) WITH CHECK (public.is_finance_ledger_manager());
CREATE POLICY "finance bank accounts delete" ON public.finance_bank_accounts
  FOR DELETE TO authenticated USING (public.is_finance_ledger_manager());

DROP POLICY IF EXISTS "finance bank reconciliations manage" ON public.finance_bank_reconciliations;
CREATE POLICY "finance bank reconciliations insert" ON public.finance_bank_reconciliations
  FOR INSERT TO authenticated WITH CHECK (public.is_finance_ledger_manager());
CREATE POLICY "finance bank reconciliations update" ON public.finance_bank_reconciliations
  FOR UPDATE TO authenticated USING (public.is_finance_ledger_manager()) WITH CHECK (public.is_finance_ledger_manager());
CREATE POLICY "finance bank reconciliations delete" ON public.finance_bank_reconciliations
  FOR DELETE TO authenticated USING (public.is_finance_ledger_manager());

DROP POLICY IF EXISTS "finance bank recon items manage" ON public.finance_bank_reconciliation_items;
CREATE POLICY "finance bank recon items insert" ON public.finance_bank_reconciliation_items
  FOR INSERT TO authenticated WITH CHECK (public.is_finance_ledger_manager());
CREATE POLICY "finance bank recon items update" ON public.finance_bank_reconciliation_items
  FOR UPDATE TO authenticated USING (public.is_finance_ledger_manager()) WITH CHECK (public.is_finance_ledger_manager());
CREATE POLICY "finance bank recon items delete" ON public.finance_bank_reconciliation_items
  FOR DELETE TO authenticated USING (public.is_finance_ledger_manager());

-- ---------------------------------------------------------------------------
-- Import, matching, and reconciliation RPCs
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.import_finance_bank_statement(
  _ngo_id uuid,
  _bank_account_id uuid,
  _statement_start_date date,
  _statement_end_date date,
  _beginning_balance numeric,
  _ending_balance numeric,
  _file_path text,
  _file_name text,
  _file_type text,
  _file_size integer,
  _content_sha256 text,
  _rows jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_hash text := lower(trim(COALESCE(_content_sha256, '')));
  existing_import public.finance_bank_statement_imports;
  statement_document public.documents;
  statement_import public.finance_bank_statement_imports;
  source_row record;
  transaction_date_value date;
  posted_date_value date;
  amount_value numeric(18, 2);
  description_value text;
  fingerprint_value text;
  total_value numeric(18, 2);
  rows_inserted integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_finance_ledger_manager() THEN
    RAISE EXCEPTION 'Finance manager access required to import statements';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.finance_bank_accounts
    WHERE id = _bank_account_id AND ngo_id = _ngo_id AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Bank or card account is inactive or belongs to another NGO';
  END IF;
  IF _statement_start_date IS NULL OR _statement_end_date IS NULL OR _statement_end_date < _statement_start_date THEN
    RAISE EXCEPTION 'Select a valid statement date range';
  END IF;
  IF _file_path NOT LIKE ('internal/finance/bank-statements/' || _ngo_id::text || '/' || _bank_account_id::text || '/%') THEN
    RAISE EXCEPTION 'Statement storage path is outside the selected NGO bank folder';
  END IF;
  IF NULLIF(trim(_file_name), '') IS NULL THEN RAISE EXCEPTION 'Statement file name is required'; END IF;
  IF COALESCE(_file_size, 0) <= 0 OR _file_size > 15728640 THEN RAISE EXCEPTION 'Statement must be between 1 byte and 15 MB'; END IF;
  IF COALESCE(_file_type, '') NOT IN ('text/csv', 'application/csv', 'application/vnd.ms-excel', 'text/plain') THEN
    RAISE EXCEPTION 'Statement import must be a CSV file';
  END IF;
  IF normalized_hash !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'A valid SHA-256 statement fingerprint is required'; END IF;
  IF jsonb_typeof(_rows) <> 'array' OR jsonb_array_length(_rows) = 0 THEN RAISE EXCEPTION 'Statement has no transaction rows'; END IF;
  IF jsonb_array_length(_rows) > 5000 THEN RAISE EXCEPTION 'Statement cannot exceed 5,000 rows'; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(_bank_account_id::text || ':' || normalized_hash, 0));
  SELECT * INTO existing_import FROM public.finance_bank_statement_imports
  WHERE bank_account_id = _bank_account_id AND content_sha256 = normalized_hash;
  IF existing_import.id IS NOT NULL THEN
    RETURN jsonb_build_object('import', to_jsonb(existing_import), 'is_duplicate', true);
  END IF;

  INSERT INTO public.documents (
    ngo_id, file_path, file_name, file_type, file_size, category,
    uploaded_by_user_id, review_status, title
  ) VALUES (
    _ngo_id, _file_path, trim(_file_name), _file_type, _file_size, 'finance',
    auth.uid(), 'pending', 'Bank statement — ' || trim(_file_name)
  ) RETURNING * INTO statement_document;

  INSERT INTO public.finance_bank_statement_imports (
    ngo_id, bank_account_id, document_id, content_sha256, file_name,
    statement_start_date, statement_end_date, beginning_balance, ending_balance,
    imported_by_user_id
  ) VALUES (
    _ngo_id, _bank_account_id, statement_document.id, normalized_hash, trim(_file_name),
    _statement_start_date, _statement_end_date, round(_beginning_balance, 2), round(_ending_balance, 2),
    auth.uid()
  ) RETURNING * INTO statement_import;

  FOR source_row IN SELECT value AS row_json, ordinality::integer AS row_number
                    FROM jsonb_array_elements(_rows) WITH ORDINALITY
  LOOP
    IF COALESCE(source_row.row_json->>'transaction_date', '') !~ '^\d{4}-\d{2}-\d{2}$' THEN
      RAISE EXCEPTION 'Statement row % has an invalid transaction date', source_row.row_number;
    END IF;
    transaction_date_value := (source_row.row_json->>'transaction_date')::date;
    IF transaction_date_value < _statement_start_date - 7 OR transaction_date_value > _statement_end_date + 7 THEN
      RAISE EXCEPTION 'Statement row % falls outside the statement period', source_row.row_number;
    END IF;
    posted_date_value := NULL;
    IF COALESCE(source_row.row_json->>'posted_date', '') ~ '^\d{4}-\d{2}-\d{2}$' THEN
      posted_date_value := (source_row.row_json->>'posted_date')::date;
    END IF;
    amount_value := round((source_row.row_json->>'amount')::numeric, 2);
    IF amount_value = 0 THEN RAISE EXCEPTION 'Statement row % has a zero amount', source_row.row_number; END IF;
    description_value := NULLIF(trim(source_row.row_json->>'description'), '');
    IF description_value IS NULL THEN RAISE EXCEPTION 'Statement row % has no description', source_row.row_number; END IF;
    fingerprint_value := encode(extensions.digest(
      concat_ws('|',
        COALESCE(source_row.row_json->>'source_transaction_id', ''),
        transaction_date_value::text,
        amount_value::text,
        lower(description_value),
        COALESCE(source_row.row_json->>'reference_number', '')
      ), 'sha256'
    ), 'hex');

    INSERT INTO public.finance_bank_statement_transactions (
      import_id, ngo_id, bank_account_id, row_number, source_transaction_id,
      transaction_date, posted_date, description, amount, currency,
      reference_number, transaction_fingerprint, raw_json
    ) VALUES (
      statement_import.id, _ngo_id, _bank_account_id, source_row.row_number,
      NULLIF(trim(source_row.row_json->>'source_transaction_id'), ''),
      transaction_date_value, posted_date_value, description_value, amount_value,
      upper(left(COALESCE(NULLIF(trim(source_row.row_json->>'currency'), ''), 'USD'), 3)),
      NULLIF(trim(source_row.row_json->>'reference_number'), ''), fingerprint_value,
      COALESCE(source_row.row_json->'raw', source_row.row_json)
    );
  END LOOP;

  SELECT COALESCE(sum(amount), 0), count(*)::integer INTO total_value, rows_inserted
  FROM public.finance_bank_statement_transactions WHERE import_id = statement_import.id;
  UPDATE public.finance_bank_statement_imports
  SET transaction_total = total_value,
      statement_variance = round(_ending_balance - _beginning_balance - total_value, 2),
      row_count = rows_inserted,
      updated_at = now()
  WHERE id = statement_import.id
  RETURNING * INTO statement_import;

  PERFORM public.finance_log_audit_event(
    'finance_bank_statement_import', statement_import.id, 'statement_imported',
    jsonb_build_object('ngo_id', _ngo_id, 'bank_account_id', _bank_account_id,
      'row_count', rows_inserted, 'statement_variance', statement_import.statement_variance)
  );
  RETURN jsonb_build_object('import', to_jsonb(statement_import), 'is_duplicate', false);
END;
$$;

CREATE OR REPLACE FUNCTION public.suggest_finance_bank_statement_matches(_import_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_finance_ledger_manager() THEN RAISE EXCEPTION 'Finance manager access required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.finance_bank_statement_imports WHERE id = _import_id AND status = 'matching') THEN
    RAISE EXCEPTION 'Statement import is not available for matching';
  END IF;

  WITH candidates AS (
    SELECT statement_tx.id AS statement_transaction_id,
           line.id AS journal_line_id,
           (0.85
             + CASE WHEN entry.entry_date = statement_tx.transaction_date THEN 0.10 ELSE 0 END
             + CASE WHEN lower(COALESCE(line.memo, entry.memo, '')) LIKE
                       '%' || lower(split_part(statement_tx.description, ' ', 1)) || '%'
                    THEN 0.05 ELSE 0 END) AS confidence,
           row_number() OVER (
             PARTITION BY statement_tx.id
             ORDER BY abs(entry.entry_date - statement_tx.transaction_date), entry.created_at, line.id
           ) AS candidate_rank
    FROM public.finance_bank_statement_transactions statement_tx
    JOIN public.finance_bank_statement_imports statement_import ON statement_import.id = statement_tx.import_id
    JOIN public.finance_bank_accounts bank ON bank.id = statement_tx.bank_account_id
    JOIN public.finance_accounts account ON account.id = bank.linked_finance_account_id
    JOIN public.finance_journal_lines line ON line.account_id = bank.linked_finance_account_id
    JOIN public.finance_journal_entries entry ON entry.id = line.journal_entry_id
    WHERE statement_tx.import_id = _import_id
      AND statement_tx.match_status IN ('unmatched', 'suggested')
      AND entry.status = 'posted'
      AND entry.ngo_id = statement_tx.ngo_id
      AND abs(entry.entry_date - statement_tx.transaction_date) <= 7
      AND round(
        CASE WHEN account.normal_balance = 'debit' THEN line.debit - line.credit
             ELSE line.credit - line.debit END, 2
      ) = statement_tx.amount
      AND NOT EXISTS (
        SELECT 1 FROM public.finance_bank_statement_transactions used
        WHERE used.matched_journal_line_id = line.id
          AND used.match_status IN ('matched', 'reconciled')
      )
  )
  UPDATE public.finance_bank_statement_transactions statement_tx
  SET suggested_journal_line_id = candidate.journal_line_id,
      match_confidence = least(candidate.confidence, 1),
      match_status = 'suggested',
      updated_at = now()
  FROM candidates candidate
  WHERE candidate.statement_transaction_id = statement_tx.id
    AND candidate.candidate_rank = 1;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_finance_bank_statement_match(
  _statement_transaction_id uuid,
  _journal_line_id uuid DEFAULT NULL
)
RETURNS public.finance_bank_statement_transactions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  statement_tx public.finance_bank_statement_transactions;
  resolved_line_id uuid;
  signed_line_amount numeric(18, 2);
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_finance_ledger_manager() THEN RAISE EXCEPTION 'Finance manager access required'; END IF;
  SELECT * INTO statement_tx FROM public.finance_bank_statement_transactions
  WHERE id = _statement_transaction_id FOR UPDATE;
  IF statement_tx.id IS NULL THEN RAISE EXCEPTION 'Statement transaction not found'; END IF;
  IF statement_tx.match_status IN ('ignored', 'reconciled') THEN RAISE EXCEPTION 'Statement transaction can no longer be matched'; END IF;
  resolved_line_id := COALESCE(_journal_line_id, statement_tx.suggested_journal_line_id);
  IF resolved_line_id IS NULL THEN RAISE EXCEPTION 'Select a ledger transaction to match'; END IF;

  SELECT round(CASE WHEN account.normal_balance = 'debit' THEN line.debit - line.credit
                    ELSE line.credit - line.debit END, 2)
  INTO signed_line_amount
  FROM public.finance_journal_lines line
  JOIN public.finance_journal_entries entry ON entry.id = line.journal_entry_id
  JOIN public.finance_bank_accounts bank ON bank.id = statement_tx.bank_account_id
  JOIN public.finance_accounts account ON account.id = bank.linked_finance_account_id
  WHERE line.id = resolved_line_id
    AND line.account_id = bank.linked_finance_account_id
    AND entry.status = 'posted'
    AND entry.ngo_id = statement_tx.ngo_id;

  IF signed_line_amount IS NULL THEN RAISE EXCEPTION 'Ledger transaction is outside this NGO bank account'; END IF;
  IF signed_line_amount <> statement_tx.amount THEN RAISE EXCEPTION 'Bank and ledger amounts must match exactly'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.finance_bank_statement_transactions used
    WHERE used.matched_journal_line_id = resolved_line_id
      AND used.id <> statement_tx.id
      AND used.match_status IN ('matched', 'reconciled')
  ) THEN RAISE EXCEPTION 'Ledger transaction is already matched'; END IF;

  UPDATE public.finance_bank_statement_transactions
  SET match_status = 'matched', matched_journal_line_id = resolved_line_id,
      suggested_journal_line_id = resolved_line_id, match_confidence = 1,
      matched_by_user_id = auth.uid(), matched_at = now(), ignore_reason = NULL,
      updated_at = now()
  WHERE id = statement_tx.id RETURNING * INTO statement_tx;

  UPDATE public.finance_bank_reconciliation_items item
  SET statement_transaction_id = statement_tx.id, is_cleared = true
  FROM public.finance_bank_reconciliations reconciliation
  WHERE item.reconciliation_id = reconciliation.id
    AND reconciliation.statement_import_id = statement_tx.import_id
    AND reconciliation.status = 'in_progress'
    AND item.journal_line_id = resolved_line_id
    AND item.locked_at IS NULL;

  PERFORM public.finance_log_audit_event('finance_bank_statement_transaction', statement_tx.id, 'matched',
    jsonb_build_object('journal_line_id', resolved_line_id, 'amount', statement_tx.amount));
  RETURN statement_tx;
END;
$$;

CREATE OR REPLACE FUNCTION public.unmatch_finance_bank_statement_transaction(_statement_transaction_id uuid)
RETURNS public.finance_bank_statement_transactions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE statement_tx public.finance_bank_statement_transactions;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_finance_ledger_manager() THEN RAISE EXCEPTION 'Finance manager access required'; END IF;
  SELECT * INTO statement_tx FROM public.finance_bank_statement_transactions WHERE id = _statement_transaction_id FOR UPDATE;
  IF statement_tx.id IS NULL THEN RAISE EXCEPTION 'Statement transaction not found'; END IF;
  IF statement_tx.match_status = 'reconciled' THEN RAISE EXCEPTION 'Finalized reconciliation matches cannot be changed'; END IF;

  UPDATE public.finance_bank_reconciliation_items item
  SET statement_transaction_id = NULL, is_cleared = false
  FROM public.finance_bank_reconciliations reconciliation
  WHERE item.reconciliation_id = reconciliation.id
    AND reconciliation.status = 'in_progress'
    AND item.statement_transaction_id = statement_tx.id
    AND item.locked_at IS NULL;

  UPDATE public.finance_bank_statement_transactions
  SET match_status = CASE WHEN suggested_journal_line_id IS NULL THEN 'unmatched' ELSE 'suggested' END,
      matched_journal_line_id = NULL, matched_by_user_id = NULL, matched_at = NULL,
      updated_at = now()
  WHERE id = statement_tx.id RETURNING * INTO statement_tx;
  RETURN statement_tx;
END;
$$;

CREATE OR REPLACE FUNCTION public.ignore_finance_bank_statement_transaction(
  _statement_transaction_id uuid,
  _reason text
)
RETURNS public.finance_bank_statement_transactions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE statement_tx public.finance_bank_statement_transactions;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_finance_ledger_manager() THEN RAISE EXCEPTION 'Finance manager access required'; END IF;
  IF NULLIF(trim(_reason), '') IS NULL THEN RAISE EXCEPTION 'An ignore reason is required'; END IF;
  SELECT * INTO statement_tx FROM public.finance_bank_statement_transactions WHERE id = _statement_transaction_id FOR UPDATE;
  IF statement_tx.id IS NULL THEN RAISE EXCEPTION 'Statement transaction not found'; END IF;
  IF statement_tx.match_status IN ('matched', 'reconciled') THEN RAISE EXCEPTION 'Unmatch the transaction before ignoring it'; END IF;
  UPDATE public.finance_bank_statement_transactions
  SET match_status = 'ignored', suggested_journal_line_id = NULL,
      match_confidence = NULL, ignore_reason = trim(_reason), updated_at = now()
  WHERE id = statement_tx.id RETURNING * INTO statement_tx;
  PERFORM public.finance_log_audit_event('finance_bank_statement_transaction', statement_tx.id, 'ignored',
    jsonb_build_object('reason', trim(_reason)));
  RETURN statement_tx;
END;
$$;

-- Account balances use the linked account's normal-balance direction and the
-- selected NGO. This supports both asset bank accounts and credit-card liabilities.
CREATE OR REPLACE FUNCTION public.finance_bank_account_book_balance(
  _bank_account_id uuid,
  _as_of_date date DEFAULT CURRENT_DATE
)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT round(bank.opening_balance + COALESCE(sum(
    CASE WHEN entry.id IS NULL THEN 0
         WHEN account.normal_balance = 'debit' THEN line.debit - line.credit
         ELSE line.credit - line.debit END
  ), 0), 2)
  FROM public.finance_bank_accounts bank
  JOIN public.finance_accounts account ON account.id = bank.linked_finance_account_id
  LEFT JOIN public.finance_journal_lines line ON line.account_id = bank.linked_finance_account_id
  LEFT JOIN public.finance_journal_entries entry ON entry.id = line.journal_entry_id
    AND entry.status = 'posted'
    AND entry.ngo_id = bank.ngo_id
    AND entry.entry_date <= COALESCE(_as_of_date, CURRENT_DATE)
  WHERE bank.id = _bank_account_id
  GROUP BY bank.id, bank.opening_balance;
$$;

CREATE OR REPLACE FUNCTION public.finance_bank_account_ledger_balance(_bank_account_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.finance_bank_account_book_balance(_bank_account_id, CURRENT_DATE);
$$;

CREATE OR REPLACE FUNCTION public.start_finance_bank_reconciliation(
  _ngo_id uuid,
  _bank_account_id uuid,
  _statement_start_date date,
  _statement_end_date date,
  _beginning_balance numeric,
  _ending_balance numeric,
  _statement_import_id uuid DEFAULT NULL
)
RETURNS public.finance_bank_reconciliations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE reconciliation public.finance_bank_reconciliations;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_finance_ledger_manager() THEN RAISE EXCEPTION 'Finance manager access required'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.finance_bank_accounts WHERE id = _bank_account_id AND ngo_id = _ngo_id AND is_active = true
  ) THEN RAISE EXCEPTION 'Bank account is inactive or belongs to another NGO'; END IF;
  IF _statement_end_date < _statement_start_date THEN RAISE EXCEPTION 'Statement date range is invalid'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.finance_bank_reconciliations existing
    WHERE existing.bank_account_id = _bank_account_id AND existing.status <> 'voided'
      AND daterange(existing.statement_start_date, existing.statement_end_date, '[]')
          && daterange(_statement_start_date, _statement_end_date, '[]')
  ) THEN RAISE EXCEPTION 'This bank account already has an overlapping reconciliation'; END IF;
  IF _statement_import_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.finance_bank_statement_imports statement_import
    WHERE statement_import.id = _statement_import_id
      AND statement_import.ngo_id = _ngo_id
      AND statement_import.bank_account_id = _bank_account_id
      AND statement_import.statement_start_date = _statement_start_date
      AND statement_import.statement_end_date = _statement_end_date
      AND statement_import.status = 'matching'
  ) THEN RAISE EXCEPTION 'Statement import does not match this reconciliation'; END IF;

  INSERT INTO public.finance_bank_reconciliations (
    ngo_id, bank_account_id, statement_start_date, statement_end_date,
    beginning_balance, ending_balance, status, created_by_user_id,
    statement_import_id, statement_document_id
  )
  SELECT _ngo_id, _bank_account_id, _statement_start_date, _statement_end_date,
         round(_beginning_balance, 2), round(_ending_balance, 2), 'in_progress', auth.uid(),
         _statement_import_id, statement_import.document_id
  FROM (SELECT 1) seed
  LEFT JOIN public.finance_bank_statement_imports statement_import ON statement_import.id = _statement_import_id
  RETURNING * INTO reconciliation;

  INSERT INTO public.finance_bank_reconciliation_items (
    reconciliation_id, journal_line_id, statement_transaction_id,
    transaction_date, description, amount, is_cleared
  )
  SELECT reconciliation.id, line.id, statement_tx.id,
         entry.entry_date, COALESCE(line.memo, entry.memo),
         round(CASE WHEN account.normal_balance = 'debit' THEN line.debit - line.credit
                    ELSE line.credit - line.debit END, 2),
         statement_tx.id IS NOT NULL
  FROM public.finance_bank_accounts bank
  JOIN public.finance_accounts account ON account.id = bank.linked_finance_account_id
  JOIN public.finance_journal_lines line ON line.account_id = bank.linked_finance_account_id
  JOIN public.finance_journal_entries entry ON entry.id = line.journal_entry_id
  LEFT JOIN public.finance_bank_statement_transactions statement_tx
    ON statement_tx.import_id = _statement_import_id
   AND statement_tx.matched_journal_line_id = line.id
   AND statement_tx.match_status = 'matched'
  WHERE bank.id = _bank_account_id
    AND entry.status = 'posted'
    AND entry.ngo_id = _ngo_id
    AND entry.entry_date BETWEEN _statement_start_date AND _statement_end_date;

  IF _statement_import_id IS NOT NULL THEN
    UPDATE public.finance_bank_statement_imports SET status = 'reconciling', updated_at = now()
    WHERE id = _statement_import_id;
  END IF;

  reconciliation := public.refresh_finance_bank_reconciliation_balances(reconciliation.id);
  PERFORM public.finance_log_audit_event('finance_bank_reconciliation', reconciliation.id, 'started',
    jsonb_build_object('ngo_id', _ngo_id, 'bank_account_id', _bank_account_id,
      'statement_import_id', _statement_import_id));
  RETURN reconciliation;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_finance_bank_reconciliation_balances(_recon_id uuid)
RETURNS public.finance_bank_reconciliations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE reconciliation public.finance_bank_reconciliations;
  cleared numeric(18, 2);
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_finance_ledger_manager() THEN RAISE EXCEPTION 'Finance manager access required'; END IF;
  SELECT * INTO reconciliation FROM public.finance_bank_reconciliations WHERE id = _recon_id FOR UPDATE;
  IF reconciliation.id IS NULL THEN RAISE EXCEPTION 'Reconciliation not found'; END IF;
  IF reconciliation.status <> 'in_progress' THEN RAISE EXCEPTION 'Only in-progress reconciliations can be refreshed'; END IF;

  reconciliation.book_balance := public.finance_bank_account_book_balance(
    reconciliation.bank_account_id, reconciliation.statement_end_date
  );
  SELECT COALESCE(sum(amount), 0) INTO cleared
  FROM public.finance_bank_reconciliation_items
  WHERE reconciliation_id = _recon_id AND is_cleared = true;
  reconciliation.cleared_balance := round(cleared, 2);
  reconciliation.difference := round(
    reconciliation.ending_balance - (reconciliation.beginning_balance + cleared), 2
  );

  UPDATE public.finance_bank_reconciliations
  SET book_balance = reconciliation.book_balance,
      cleared_balance = reconciliation.cleared_balance,
      difference = reconciliation.difference,
      updated_at = now()
  WHERE id = _recon_id RETURNING * INTO reconciliation;
  RETURN reconciliation;
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_finance_bank_reconciliation(
  _recon_id uuid,
  _exception_notes text DEFAULT NULL
)
RETURNS public.finance_bank_reconciliations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE reconciliation public.finance_bank_reconciliations;
  open_statement_rows integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_finance_ledger_manager() THEN RAISE EXCEPTION 'Finance manager access required'; END IF;
  reconciliation := public.refresh_finance_bank_reconciliation_balances(_recon_id);
  IF abs(reconciliation.difference) > 0.005 THEN
    RAISE EXCEPTION 'Reconciliation difference must be zero before finalizing. Difference=%', reconciliation.difference;
  END IF;

  IF reconciliation.statement_import_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.finance_bank_statement_imports
      WHERE id = reconciliation.statement_import_id AND abs(statement_variance) > 0.005
    ) THEN RAISE EXCEPTION 'Statement beginning balance, transactions, and ending balance do not tie'; END IF;

    SELECT count(*)::integer INTO open_statement_rows
    FROM public.finance_bank_statement_transactions
    WHERE import_id = reconciliation.statement_import_id
      AND match_status IN ('unmatched', 'suggested');
    IF open_statement_rows > 0 THEN
      RAISE EXCEPTION '% statement transactions still require matching or an ignore reason', open_statement_rows;
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.finance_bank_statement_transactions statement_tx
      WHERE statement_tx.import_id = reconciliation.statement_import_id
        AND statement_tx.match_status = 'matched'
        AND NOT EXISTS (
          SELECT 1 FROM public.finance_bank_reconciliation_items item
          WHERE item.reconciliation_id = reconciliation.id
            AND item.statement_transaction_id = statement_tx.id
            AND item.is_cleared = true
        )
    ) THEN RAISE EXCEPTION 'Every matched statement transaction must be cleared in the reconciliation'; END IF;
  END IF;

  UPDATE public.finance_bank_reconciliation_items SET locked_at = now()
  WHERE reconciliation_id = reconciliation.id;
  UPDATE public.finance_bank_reconciliations
  SET status = 'finalized', exception_notes = NULLIF(trim(_exception_notes), ''),
      notes = COALESCE(NULLIF(trim(_exception_notes), ''), notes),
      approval_status = 'approved', approved_by_user_id = auth.uid(), approved_at = now(),
      finalized_by_user_id = auth.uid(), finalized_at = now(), updated_at = now()
  WHERE id = reconciliation.id RETURNING * INTO reconciliation;

  IF reconciliation.statement_import_id IS NOT NULL THEN
    UPDATE public.finance_bank_statement_transactions SET match_status = 'reconciled', updated_at = now()
    WHERE import_id = reconciliation.statement_import_id AND match_status = 'matched';
    UPDATE public.finance_bank_statement_imports SET status = 'reconciled', updated_at = now()
    WHERE id = reconciliation.statement_import_id;
    UPDATE public.documents SET review_status = 'approved', reviewer_user_id = auth.uid(),
      reviewed_at = now(), review_notes = 'Statement matched and reconciliation finalized', updated_at = now()
    WHERE id = reconciliation.statement_document_id;
  END IF;

  PERFORM public.finance_log_audit_event('finance_bank_reconciliation', reconciliation.id, 'finalized',
    jsonb_build_object('difference', reconciliation.difference, 'book_balance', reconciliation.book_balance,
      'statement_import_id', reconciliation.statement_import_id));
  RETURN reconciliation;
END;
$$;

CREATE OR REPLACE FUNCTION public.finance_guard_reconciliation_item()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE reconciliation_status public.finance_reconciliation_status;
BEGIN
  SELECT status INTO reconciliation_status FROM public.finance_bank_reconciliations
  WHERE id = COALESCE(NEW.reconciliation_id, OLD.reconciliation_id);
  IF reconciliation_status = 'finalized' OR OLD.locked_at IS NOT NULL THEN
    RAISE EXCEPTION 'Finalized reconciliation items are immutable';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DROP TRIGGER IF EXISTS trg_finance_guard_reconciliation_item ON public.finance_bank_reconciliation_items;
CREATE TRIGGER trg_finance_guard_reconciliation_item
  BEFORE UPDATE OR DELETE ON public.finance_bank_reconciliation_items
  FOR EACH ROW EXECUTE FUNCTION public.finance_guard_reconciliation_item();

REVOKE ALL ON FUNCTION public.import_finance_bank_statement(uuid, uuid, date, date, numeric, numeric, text, text, text, integer, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.import_finance_bank_statement(uuid, uuid, date, date, numeric, numeric, text, text, text, integer, text, jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.suggest_finance_bank_statement_matches(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.suggest_finance_bank_statement_matches(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.confirm_finance_bank_statement_match(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_finance_bank_statement_match(uuid, uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.unmatch_finance_bank_statement_transaction(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unmatch_finance_bank_statement_transaction(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.ignore_finance_bank_statement_transaction(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ignore_finance_bank_statement_transaction(uuid, text) TO authenticated;
REVOKE ALL ON FUNCTION public.start_finance_bank_reconciliation(uuid, uuid, date, date, numeric, numeric, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_finance_bank_reconciliation(uuid, uuid, date, date, numeric, numeric, uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.finance_bank_account_book_balance(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finance_bank_account_book_balance(uuid, date) TO authenticated;
REVOKE ALL ON FUNCTION public.finance_bank_account_ledger_balance(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finance_bank_account_ledger_balance(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.refresh_finance_bank_reconciliation_balances(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.refresh_finance_bank_reconciliation_balances(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.finalize_finance_bank_reconciliation(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finalize_finance_bank_reconciliation(uuid, text) TO authenticated;
