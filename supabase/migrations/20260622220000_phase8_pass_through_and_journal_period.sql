-- Phase 8 continuation: pass-through request creation and journal fiscal period on save

CREATE OR REPLACE FUNCTION public.create_finance_pass_through_request(
  _ngo_id uuid,
  _requested_amount numeric,
  _deposit_id uuid DEFAULT NULL,
  _fund_id uuid DEFAULT NULL,
  _restriction_type text DEFAULT NULL,
  _restriction_notes text DEFAULT NULL,
  _memo text DEFAULT NULL
)
RETURNS public.finance_pass_through_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  req public.finance_pass_through_requests;
  req_num text;
  fee_amount numeric(18, 2) := 0;
BEGIN
  IF NOT public.is_finance_ledger_manager() THEN
    RAISE EXCEPTION 'Finance manager access required';
  END IF;

  IF _requested_amount IS NULL OR _requested_amount <= 0 THEN
    RAISE EXCEPTION 'Requested amount must be greater than zero';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.ngos WHERE id = _ngo_id) THEN
    RAISE EXCEPTION 'NGO not found';
  END IF;

  SELECT f.suggested_fee INTO fee_amount
  FROM public.finance_calculate_admin_fee(_requested_amount, _ngo_id, NULL) f
  LIMIT 1;

  fee_amount := COALESCE(fee_amount, 0);

  req_num := 'PTR-' || to_char(CURRENT_DATE, 'YYYY') || '-' ||
    lpad((SELECT COUNT(*) + 1 FROM public.finance_pass_through_requests)::text, 5, '0');

  INSERT INTO public.finance_pass_through_requests (
    request_number,
    deposit_id,
    ngo_id,
    fund_id,
    requested_amount,
    admin_fee_amount,
    net_disbursement_amount,
    restriction_type,
    restriction_notes,
    status,
    requested_by_user_id,
    memo
  ) VALUES (
    req_num,
    _deposit_id,
    _ngo_id,
    _fund_id,
    _requested_amount,
    fee_amount,
    _requested_amount - fee_amount,
    _restriction_type,
    _restriction_notes,
    'pending',
    auth.uid(),
    _memo
  )
  RETURNING * INTO req;

  PERFORM public.finance_log_audit_event('finance_pass_through_request', req.id, 'created',
    jsonb_build_object('request_number', req.request_number, 'amount', _requested_amount));

  RETURN req;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_finance_journal_entry(
  _entry_id uuid DEFAULT NULL,
  _entry_date date DEFAULT CURRENT_DATE,
  _memo text DEFAULT NULL,
  _source_type text DEFAULT NULL,
  _source_id uuid DEFAULT NULL,
  _fiscal_period_id uuid DEFAULT NULL,
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
  resolved_period_id uuid;
BEGIN
  IF NOT public.is_finance_ledger_manager() AND NOT public.can_write_finance_drafts() THEN
    RAISE EXCEPTION 'Finance access required to save journal entries';
  END IF;

  IF _fiscal_period_id IS NOT NULL THEN
    resolved_period_id := public.get_finance_open_fiscal_period(_entry_date, _fiscal_period_id);
  END IF;

  IF _entry_id IS NOT NULL THEN
    SELECT * INTO entry FROM public.finance_journal_entries WHERE id = _entry_id FOR UPDATE;
    IF entry.id IS NULL THEN RAISE EXCEPTION 'Journal entry not found'; END IF;
    IF entry.status <> 'draft' THEN RAISE EXCEPTION 'Only draft journal entries can be edited'; END IF;

    UPDATE public.finance_journal_entries
    SET entry_date = _entry_date,
        memo = NULLIF(trim(_memo), ''),
        source_type = NULLIF(trim(_source_type), ''),
        source_id = _source_id,
        fiscal_period_id = COALESCE(resolved_period_id, fiscal_period_id),
        updated_at = now()
    WHERE id = _entry_id
    RETURNING * INTO entry;

    DELETE FROM public.finance_journal_lines WHERE journal_entry_id = _entry_id;
  ELSE
    INSERT INTO public.finance_journal_entries (
      entry_date, memo, source_type, source_id, fiscal_period_id, status, created_by_user_id, entry_number
    ) VALUES (
      _entry_date,
      NULLIF(trim(_memo), ''),
      NULLIF(trim(_source_type), ''),
      _source_id,
      resolved_period_id,
      'draft',
      auth.uid(),
      ''
    )
    RETURNING * INTO entry;
  END IF;

  FOR line IN SELECT value FROM jsonb_array_elements(COALESCE(_lines, '[]'::jsonb))
  LOOP
    IF COALESCE(line->>'account_id', '') = '' THEN CONTINUE; END IF;
    line_no := line_no + 1;
    INSERT INTO public.finance_journal_lines (
      journal_entry_id, account_id, debit, credit, memo,
      fund_id, ngo_id, department_id, dimension_id, document_id,
      grant_application_id, work_item_id, line_number
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
    jsonb_build_object('line_count', line_no, 'fiscal_period_id', entry.fiscal_period_id)
  );

  RETURN entry;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_finance_report_snapshot(
  _report_type text,
  _label text,
  _filters jsonb DEFAULT '{}'::jsonb,
  _data jsonb DEFAULT '{}'::jsonb
)
RETURNS public.finance_report_snapshots
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  snap public.finance_report_snapshots;
BEGIN
  IF NOT public.can_read_finance_ledger() THEN
    RAISE EXCEPTION 'Not authorized to save report snapshots';
  END IF;

  INSERT INTO public.finance_report_snapshots (report_type, label, filters_json, data_json, created_by_user_id)
  VALUES (_report_type, _label, COALESCE(_filters, '{}'::jsonb), COALESCE(_data, '{}'::jsonb), auth.uid())
  RETURNING * INTO snap;

  PERFORM public.log_finance_export(_report_type, _filters);
  RETURN snap;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_finance_pass_through_request(uuid, numeric, uuid, uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_finance_report_snapshot(text, text, jsonb, jsonb) TO authenticated;
