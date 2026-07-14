-- Retain the original migration CSV as source evidence and attach it to the
-- posted opening-balance journal.

ALTER TABLE public.finance_fiscal_periods
  ADD COLUMN IF NOT EXISTS opening_balance_source_document_id uuid
    REFERENCES public.documents(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS opening_balance_source_sha256 text;

CREATE INDEX IF NOT EXISTS idx_finance_fiscal_period_opening_document
  ON public.finance_fiscal_periods(opening_balance_source_document_id)
  WHERE opening_balance_source_document_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.import_finance_opening_balances_with_source(
  _fiscal_period_id uuid,
  _ngo_id uuid,
  _rows jsonb,
  _file_path text,
  _file_name text,
  _file_size integer,
  _content_sha256 text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  period_row public.finance_fiscal_periods;
  source_document public.documents;
  result jsonb;
  normalized_hash text := lower(trim(COALESCE(_content_sha256, '')));
  path_scope text := COALESCE(_ngo_id::text, 'hpg');
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_finance_ledger_manager() THEN
    RAISE EXCEPTION 'Finance manager access required';
  END IF;

  SELECT * INTO period_row FROM public.finance_fiscal_periods
  WHERE id = _fiscal_period_id FOR UPDATE;
  IF period_row.id IS NULL THEN RAISE EXCEPTION 'Fiscal period not found'; END IF;
  IF period_row.ngo_id IS DISTINCT FROM _ngo_id THEN
    RAISE EXCEPTION 'Opening balance NGO must match the fiscal period';
  END IF;
  IF _file_path NOT LIKE (
    'internal/finance/opening-balances/' || path_scope || '/' || _fiscal_period_id::text || '/%'
  ) THEN
    RAISE EXCEPTION 'Opening balance file is outside the selected entity folder';
  END IF;
  IF NULLIF(trim(_file_name), '') IS NULL OR lower(_file_name) NOT LIKE '%.csv' THEN
    RAISE EXCEPTION 'Opening balance source must be a CSV file';
  END IF;
  IF COALESCE(_file_size, 0) <= 0 OR _file_size > 15728640 THEN
    RAISE EXCEPTION 'Opening balance CSV must be between 1 byte and 15 MB';
  END IF;
  IF normalized_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'A valid SHA-256 source fingerprint is required';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('opening-balance:' || _fiscal_period_id::text, 0));
  result := public.import_finance_opening_balances(_fiscal_period_id, _ngo_id, _rows);

  INSERT INTO public.documents (
    ngo_id, file_path, file_name, file_type, file_size, category,
    uploaded_by_user_id, review_status, title
  ) VALUES (
    _ngo_id, _file_path, trim(_file_name), 'text/csv', _file_size, 'finance',
    auth.uid(), 'pending', 'Opening balance import — ' || period_row.label
  ) RETURNING * INTO source_document;

  UPDATE public.finance_fiscal_periods
  SET opening_balance_source_document_id = source_document.id,
      opening_balance_source_sha256 = normalized_hash,
      updated_at = now()
  WHERE id = period_row.id;

  PERFORM public.finance_log_audit_event(
    'finance_fiscal_period', period_row.id, 'opening_balance_source_attached',
    jsonb_build_object(
      'ngo_id', _ngo_id,
      'document_id', source_document.id,
      'file_name', trim(_file_name),
      'content_sha256', normalized_hash
    )
  );

  RETURN result || jsonb_build_object('document_id', source_document.id, 'content_sha256', normalized_hash);
END;
$$;

CREATE OR REPLACE FUNCTION public.post_finance_opening_balances(_fiscal_period_id uuid)
RETURNS public.finance_journal_entries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  period_row public.finance_fiscal_periods;
  entry_row public.finance_journal_entries;
  line_count integer;
  total_debit numeric(18, 2);
  total_credit numeric(18, 2);
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_finance_ledger_manager() THEN
    RAISE EXCEPTION 'Finance manager access required';
  END IF;

  SELECT * INTO period_row FROM public.finance_fiscal_periods
  WHERE id = _fiscal_period_id FOR UPDATE;
  IF period_row.id IS NULL THEN RAISE EXCEPTION 'Fiscal period not found'; END IF;
  IF period_row.period_type <> 'month' OR period_row.status <> 'open' THEN
    RAISE EXCEPTION 'Opening balances can only be posted to an open monthly period';
  END IF;
  IF period_row.opening_balance_journal_entry_id IS NOT NULL THEN
    RAISE EXCEPTION 'Opening balances have already been posted for this period';
  END IF;
  IF period_row.opening_balance_source_document_id IS NULL THEN
    RAISE EXCEPTION 'Attach the source CSV before posting opening balances';
  END IF;

  SELECT count(*)::integer, COALESCE(sum(debit), 0), COALESCE(sum(credit), 0)
  INTO line_count, total_debit, total_credit
  FROM public.finance_opening_balances
  WHERE fiscal_period_id = period_row.id;

  IF line_count < 2 OR total_debit <= 0 OR round(total_debit, 2) <> round(total_credit, 2) THEN
    RAISE EXCEPTION 'Opening balances must contain at least two balanced lines. Debits=% Credits=%', total_debit, total_credit;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.finance_opening_balances balance
    WHERE balance.fiscal_period_id = period_row.id
      AND balance.ngo_id IS DISTINCT FROM period_row.ngo_id
  ) THEN
    RAISE EXCEPTION 'Opening balance entity scope is inconsistent';
  END IF;

  INSERT INTO public.finance_journal_entries (
    entry_date, memo, source_type, source_id, status,
    created_by_user_id, ngo_id, fiscal_period_id
  ) VALUES (
    period_row.start_date,
    'Opening balances — ' || period_row.label,
    'finance_opening_balance', period_row.id, 'draft',
    auth.uid(), period_row.ngo_id, period_row.id
  ) RETURNING * INTO entry_row;

  INSERT INTO public.finance_journal_lines (
    journal_entry_id, account_id, debit, credit, memo,
    fund_id, ngo_id, document_id, line_number
  )
  SELECT
    entry_row.id, balance.account_id, balance.debit, balance.credit,
    COALESCE(balance.memo, 'Opening balance'), balance.fund_id,
    period_row.ngo_id, period_row.opening_balance_source_document_id,
    row_number() OVER (ORDER BY account.code, balance.created_at, balance.id)::integer
  FROM public.finance_opening_balances balance
  JOIN public.finance_accounts account ON account.id = balance.account_id
  WHERE balance.fiscal_period_id = period_row.id;

  entry_row := public.post_finance_journal_entry(entry_row.id);

  UPDATE public.finance_fiscal_periods
  SET opening_balance_journal_entry_id = entry_row.id, updated_at = now()
  WHERE id = period_row.id;

  INSERT INTO public.finance_document_links (
    document_id, entity_type, entity_id, link_notes, created_by_user_id
  ) VALUES (
    period_row.opening_balance_source_document_id,
    'journal_entry', entry_row.id,
    'Source CSV for posted opening balances', auth.uid()
  ) ON CONFLICT DO NOTHING;

  UPDATE public.documents
  SET review_status = 'approved', reviewer_user_id = auth.uid(), reviewed_at = now(),
      review_notes = 'Balanced opening balances posted to ' || entry_row.entry_number,
      updated_at = now()
  WHERE id = period_row.opening_balance_source_document_id;

  PERFORM public.finance_log_audit_event(
    'finance_fiscal_period', period_row.id, 'opening_balances_posted',
    jsonb_build_object(
      'ngo_id', period_row.ngo_id,
      'journal_entry_id', entry_row.id,
      'entry_number', entry_row.entry_number,
      'source_document_id', period_row.opening_balance_source_document_id,
      'total_debit', total_debit,
      'total_credit', total_credit
    )
  );
  RETURN entry_row;
END;
$$;

REVOKE ALL ON FUNCTION public.import_finance_opening_balances_with_source(uuid, uuid, jsonb, text, text, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.import_finance_opening_balances_with_source(uuid, uuid, jsonb, text, text, integer, text) TO authenticated;
REVOKE ALL ON FUNCTION public.post_finance_opening_balances(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.post_finance_opening_balances(uuid) TO authenticated;
