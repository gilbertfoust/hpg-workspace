-- Final accounting cutover controls. An NGO becomes a live system-of-record
-- only after objective report comparison, bank/opening evidence, operating
-- controls, and an accountant attestation all pass together.

CREATE TABLE public.finance_parallel_close_comparisons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ngo_id uuid NOT NULL REFERENCES public.ngos(id) ON DELETE RESTRICT,
  comparison_start_date date NOT NULL,
  comparison_end_date date NOT NULL,
  prior_system_name text NOT NULL DEFAULT 'Prior accounting system' CHECK (trim(prior_system_name) <> ''),
  prior_source_document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE RESTRICT,
  prior_metrics jsonb NOT NULL,
  system_metrics jsonb NOT NULL,
  variances jsonb NOT NULL,
  tolerance numeric(18,2) NOT NULL DEFAULT 0.01 CHECK (tolerance >= 0 AND tolerance <= 1000),
  is_matched boolean NOT NULL DEFAULT false,
  status text NOT NULL CHECK (status IN ('variance','matched','approved')),
  notes text,
  prepared_by_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_by_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT finance_parallel_close_dates CHECK (comparison_end_date >= comparison_start_date),
  CONSTRAINT finance_parallel_close_prior_metrics_object CHECK (jsonb_typeof(prior_metrics) = 'object'),
  CONSTRAINT finance_parallel_close_system_metrics_object CHECK (jsonb_typeof(system_metrics) = 'object'),
  CONSTRAINT finance_parallel_close_variances_object CHECK (jsonb_typeof(variances) = 'object')
);

CREATE TABLE public.finance_go_live_certifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ngo_id uuid NOT NULL UNIQUE REFERENCES public.ngos(id) ON DELETE RESTRICT,
  cutover_date date NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','ready','live','suspended')),
  opening_balance_mode text NOT NULL DEFAULT 'imported' CHECK (opening_balance_mode IN ('imported','new_zero_balance')),
  zero_balance_attested boolean NOT NULL DEFAULT false,
  bank_data_mode text NOT NULL DEFAULT 'manual_csv' CHECK (bank_data_mode IN ('manual_csv','provider')),
  parallel_close_id uuid REFERENCES public.finance_parallel_close_comparisons(id) ON DELETE RESTRICT,
  coa_approved boolean NOT NULL DEFAULT false,
  restricted_funds_reviewed boolean NOT NULL DEFAULT false,
  ap_ar_reviewed boolean NOT NULL DEFAULT false,
  access_reviewed boolean NOT NULL DEFAULT false,
  receipt_workflow_verified boolean NOT NULL DEFAULT false,
  historical_archive_retained boolean NOT NULL DEFAULT false,
  accountant_name text,
  accountant_credential text,
  accountant_attestation text,
  accountant_signoff_document_id uuid REFERENCES public.documents(id) ON DELETE RESTRICT,
  accountant_signed_at timestamptz,
  readiness_snapshot jsonb,
  activated_by_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  activated_at timestamptz,
  suspended_by_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  suspended_at timestamptz,
  suspension_reason text,
  created_by_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_finance_parallel_close_ngo_dates
  ON public.finance_parallel_close_comparisons(ngo_id, comparison_end_date DESC, created_at DESC);
CREATE INDEX idx_finance_go_live_status
  ON public.finance_go_live_certifications(status, cutover_date, ngo_id);

CREATE TRIGGER trg_finance_parallel_close_updated_at
  BEFORE UPDATE ON public.finance_parallel_close_comparisons
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_finance_go_live_updated_at
  BEFORE UPDATE ON public.finance_go_live_certifications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.finance_parallel_close_comparisons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_go_live_certifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "finance parallel close read"
  ON public.finance_parallel_close_comparisons FOR SELECT TO authenticated
  USING (public.can_read_finance_ledger());
CREATE POLICY "finance go live certification read"
  ON public.finance_go_live_certifications FOR SELECT TO authenticated
  USING (public.can_read_finance_ledger());

GRANT SELECT ON public.finance_parallel_close_comparisons,
  public.finance_go_live_certifications TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.finance_parallel_close_comparisons,
  public.finance_go_live_certifications FROM authenticated, anon;

CREATE OR REPLACE FUNCTION public.finance_compare_cutover_metrics(
  _system_metrics jsonb,
  _prior_metrics jsonb
)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'trial_balance_debits', round(COALESCE((_system_metrics->>'trial_balance_debits')::numeric,0) - COALESCE((_prior_metrics->>'trial_balance_debits')::numeric,0), 2),
    'trial_balance_credits', round(COALESCE((_system_metrics->>'trial_balance_credits')::numeric,0) - COALESCE((_prior_metrics->>'trial_balance_credits')::numeric,0), 2),
    'total_assets', round(COALESCE((_system_metrics->>'total_assets')::numeric,0) - COALESCE((_prior_metrics->>'total_assets')::numeric,0), 2),
    'total_liabilities_and_net_assets', round(COALESCE((_system_metrics->>'total_liabilities_and_net_assets')::numeric,0) - COALESCE((_prior_metrics->>'total_liabilities_and_net_assets')::numeric,0), 2),
    'total_revenue', round(COALESCE((_system_metrics->>'total_revenue')::numeric,0) - COALESCE((_prior_metrics->>'total_revenue')::numeric,0), 2),
    'total_expenses', round(COALESCE((_system_metrics->>'total_expenses')::numeric,0) - COALESCE((_prior_metrics->>'total_expenses')::numeric,0), 2),
    'ending_cash', round(COALESCE((_system_metrics->>'ending_cash')::numeric,0) - COALESCE((_prior_metrics->>'ending_cash')::numeric,0), 2),
    'accounts_receivable', round(COALESCE((_system_metrics->>'accounts_receivable')::numeric,0) - COALESCE((_prior_metrics->>'accounts_receivable')::numeric,0), 2),
    'accounts_payable', round(COALESCE((_system_metrics->>'accounts_payable')::numeric,0) - COALESCE((_prior_metrics->>'accounts_payable')::numeric,0), 2)
  );
$$;

CREATE OR REPLACE FUNCTION public.finance_cutover_system_metrics(
  _ngo_id uuid,
  _start_date date,
  _end_date date
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  trial_balance jsonb;
  financial_position jsonb;
  activities jsonb;
  cash_flow jsonb;
  integrity jsonb;
  ar_balance numeric(18,2) := 0;
  ap_balance numeric(18,2) := 0;
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_read_finance_ledger() THEN
    RAISE EXCEPTION 'Finance ledger access required';
  END IF;
  IF _ngo_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.ngos WHERE id = _ngo_id) THEN
    RAISE EXCEPTION 'Select a valid NGO';
  END IF;
  IF _end_date < _start_date THEN RAISE EXCEPTION 'Comparison date range is invalid'; END IF;

  trial_balance := public.finance_validate_trial_balance(_start_date, _end_date, _ngo_id);
  financial_position := public.finance_statement_of_financial_position(_end_date, _ngo_id);
  activities := public.finance_statement_of_activities(_start_date, _end_date, _ngo_id);
  cash_flow := public.finance_statement_of_cash_flows(_start_date, _end_date, _ngo_id);
  integrity := public.finance_accounting_integrity(_ngo_id, _start_date, _end_date);

  SELECT COALESCE(NULLIF(item->>'parent_amount','')::numeric,0) INTO ar_balance
  FROM jsonb_array_elements(integrity->'checks') item WHERE item->>'key' = 'accounts_receivable';
  SELECT COALESCE(NULLIF(item->>'parent_amount','')::numeric,0) INTO ap_balance
  FROM jsonb_array_elements(integrity->'checks') item WHERE item->>'key' = 'accounts_payable';

  RETURN jsonb_build_object(
    'trial_balance_debits', round(COALESCE((trial_balance->>'total_debit')::numeric,0),2),
    'trial_balance_credits', round(COALESCE((trial_balance->>'total_credit')::numeric,0),2),
    'total_assets', round(COALESCE((financial_position->>'total_assets')::numeric,0),2),
    'total_liabilities_and_net_assets', round(COALESCE((financial_position->>'total_liabilities_and_net_assets')::numeric,0),2),
    'total_revenue', round(COALESCE((activities->>'total_revenue')::numeric,0),2),
    'total_expenses', round(COALESCE((activities->>'total_expenses')::numeric,0),2),
    'ending_cash', round(COALESCE((cash_flow->>'ending_cash_balance')::numeric,0),2),
    'accounts_receivable', round(COALESCE(ar_balance,0),2),
    'accounts_payable', round(COALESCE(ap_balance,0),2),
    'ecosystem_is_balanced', COALESCE((integrity->>'is_balanced')::boolean,false),
    'captured_at', now()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.save_finance_parallel_close(
  _ngo_id uuid,
  _start_date date,
  _end_date date,
  _prior_system_name text,
  _prior_source_document_id uuid,
  _prior_metrics jsonb,
  _tolerance numeric DEFAULT 0.01,
  _notes text DEFAULT NULL
)
RETURNS public.finance_parallel_close_comparisons
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  comparison public.finance_parallel_close_comparisons;
  system_metrics jsonb;
  variances jsonb;
  metric text;
  matched boolean;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_finance_ledger_manager() THEN
    RAISE EXCEPTION 'Finance manager access required';
  END IF;
  IF _end_date < _start_date THEN RAISE EXCEPTION 'Comparison date range is invalid'; END IF;
  IF _tolerance < 0 OR _tolerance > 1000 THEN RAISE EXCEPTION 'Comparison tolerance is invalid'; END IF;
  IF jsonb_typeof(_prior_metrics) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Prior metrics must be an object'; END IF;
  FOREACH metric IN ARRAY ARRAY[
    'trial_balance_debits','trial_balance_credits','total_assets',
    'total_liabilities_and_net_assets','total_revenue','total_expenses',
    'ending_cash','accounts_receivable','accounts_payable'
  ] LOOP
    IF NOT (_prior_metrics ? metric) OR jsonb_typeof(_prior_metrics->metric) <> 'number' THEN
      RAISE EXCEPTION 'Prior metric % must be numeric', metric;
    END IF;
  END LOOP;
  IF NOT EXISTS (
    SELECT 1 FROM public.documents document
    WHERE document.id = _prior_source_document_id AND document.ngo_id = _ngo_id
  ) THEN RAISE EXCEPTION 'Prior-system evidence document must belong to the selected NGO'; END IF;

  system_metrics := public.finance_cutover_system_metrics(_ngo_id, _start_date, _end_date);
  variances := public.finance_compare_cutover_metrics(system_metrics, _prior_metrics);
  SELECT bool_and(abs((value #>> '{}')::numeric) <= _tolerance) INTO matched
  FROM jsonb_each(variances);
  matched := COALESCE(matched,false) AND COALESCE((system_metrics->>'ecosystem_is_balanced')::boolean,false);

  INSERT INTO public.finance_parallel_close_comparisons (
    ngo_id, comparison_start_date, comparison_end_date, prior_system_name,
    prior_source_document_id, prior_metrics, system_metrics, variances,
    tolerance, is_matched, status, notes, prepared_by_user_id
  ) VALUES (
    _ngo_id, _start_date, _end_date,
    COALESCE(NULLIF(trim(_prior_system_name),''),'Prior accounting system'),
    _prior_source_document_id, _prior_metrics, system_metrics, variances,
    _tolerance, matched, CASE WHEN matched THEN 'matched' ELSE 'variance' END,
    NULLIF(trim(_notes),''), auth.uid()
  ) RETURNING * INTO comparison;

  PERFORM public.finance_log_audit_event(
    'finance_parallel_close', comparison.id, 'compared',
    jsonb_build_object('ngo_id', _ngo_id, 'start_date', _start_date,
      'end_date', _end_date, 'matched', matched, 'variances', variances)
  );
  RETURN comparison;
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_finance_parallel_close(_comparison_id uuid)
RETURNS public.finance_parallel_close_comparisons
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  comparison public.finance_parallel_close_comparisons;
  current_metrics jsonb;
  current_variances jsonb;
  still_matched boolean;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_finance_ledger_manager() THEN
    RAISE EXCEPTION 'Finance manager access required';
  END IF;
  SELECT * INTO comparison FROM public.finance_parallel_close_comparisons
  WHERE id = _comparison_id FOR UPDATE;
  IF comparison.id IS NULL THEN RAISE EXCEPTION 'Parallel close comparison not found'; END IF;
  IF comparison.status = 'approved' THEN RETURN comparison; END IF;

  current_metrics := public.finance_cutover_system_metrics(
    comparison.ngo_id, comparison.comparison_start_date, comparison.comparison_end_date
  );
  current_variances := public.finance_compare_cutover_metrics(current_metrics, comparison.prior_metrics);
  SELECT bool_and(abs((value #>> '{}')::numeric) <= comparison.tolerance) INTO still_matched
  FROM jsonb_each(current_variances);
  still_matched := COALESCE(still_matched,false)
    AND COALESCE((current_metrics->>'ecosystem_is_balanced')::boolean,false);
  IF NOT still_matched THEN
    RAISE EXCEPTION 'The live ledger changed or still differs from the prior system; run the comparison again';
  END IF;

  UPDATE public.finance_parallel_close_comparisons
  SET system_metrics = current_metrics, variances = current_variances,
      is_matched = true, status = 'approved', approved_by_user_id = auth.uid(),
      approved_at = now(), updated_at = now()
  WHERE id = comparison.id RETURNING * INTO comparison;
  PERFORM public.finance_log_audit_event(
    'finance_parallel_close', comparison.id, 'approved',
    jsonb_build_object('ngo_id', comparison.ngo_id, 'variances', current_variances)
  );
  RETURN comparison;
END;
$$;

CREATE OR REPLACE FUNCTION public.finance_go_live_readiness(_ngo_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  certification public.finance_go_live_certifications;
  comparison public.finance_parallel_close_comparisons;
  active_accounts integer := 0;
  active_banks integer := 0;
  unreconciled_banks integer := 0;
  unconnected_banks integer := 0;
  opening_ready boolean := false;
  parallel_ready boolean := false;
  ecosystem_ready boolean := false;
  operating_controls_ready boolean := false;
  signoff_ready boolean := false;
  provider_ready boolean := false;
  checks jsonb;
  blockers jsonb;
  ready boolean;
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_read_finance_ledger() THEN
    RAISE EXCEPTION 'Finance ledger access required';
  END IF;
  SELECT * INTO certification FROM public.finance_go_live_certifications WHERE ngo_id = _ngo_id;
  SELECT count(*)::integer INTO active_accounts FROM public.finance_ngo_accounts
    WHERE ngo_id = _ngo_id AND is_active;

  IF certification.id IS NOT NULL THEN
    IF certification.opening_balance_mode = 'new_zero_balance' THEN
      opening_ready := certification.zero_balance_attested;
    ELSE
      SELECT EXISTS (
        SELECT 1 FROM public.finance_fiscal_periods period
        JOIN public.finance_journal_entries entry ON entry.id = period.opening_balance_journal_entry_id
        WHERE period.ngo_id = _ngo_id
          AND period.start_date <= certification.cutover_date
          AND period.opening_balance_source_document_id IS NOT NULL
          AND entry.status = 'posted'
      ) INTO opening_ready;
    END IF;

    SELECT count(*)::integer INTO active_banks FROM public.finance_bank_accounts bank
      WHERE bank.ngo_id = _ngo_id AND bank.is_active
        AND bank.opening_balance_date <= certification.cutover_date;
    SELECT count(*)::integer INTO unreconciled_banks
    FROM public.finance_bank_accounts bank
    WHERE bank.ngo_id = _ngo_id AND bank.is_active
      AND bank.opening_balance_date <= certification.cutover_date
      AND NOT EXISTS (
        SELECT 1 FROM public.finance_bank_reconciliations reconciliation
        WHERE reconciliation.bank_account_id = bank.id AND reconciliation.ngo_id = _ngo_id
          AND reconciliation.status = 'finalized'
          AND reconciliation.statement_end_date >= certification.cutover_date
      );

    IF certification.parallel_close_id IS NOT NULL THEN
      SELECT * INTO comparison FROM public.finance_parallel_close_comparisons
      WHERE id = certification.parallel_close_id AND ngo_id = _ngo_id;
      parallel_ready := comparison.status = 'approved'
        AND comparison.comparison_start_date <= certification.cutover_date
        AND comparison.comparison_end_date >= certification.cutover_date;
      IF parallel_ready THEN
        ecosystem_ready := COALESCE((public.finance_accounting_integrity(
          _ngo_id, comparison.comparison_start_date, comparison.comparison_end_date
        )->>'is_balanced')::boolean,false);
      END IF;
    END IF;

    operating_controls_ready := certification.coa_approved
      AND certification.restricted_funds_reviewed AND certification.ap_ar_reviewed
      AND certification.access_reviewed AND certification.receipt_workflow_verified
      AND certification.historical_archive_retained;
    signoff_ready := certification.accountant_signed_at IS NOT NULL
      AND NULLIF(trim(certification.accountant_name),'') IS NOT NULL
      AND NULLIF(trim(certification.accountant_attestation),'') IS NOT NULL
      AND certification.accountant_signoff_document_id IS NOT NULL;

    IF certification.bank_data_mode = 'manual_csv' THEN
      provider_ready := true;
    ELSE
      SELECT count(*)::integer INTO unconnected_banks
      FROM public.finance_bank_accounts bank
      WHERE bank.ngo_id = _ngo_id AND bank.is_active
        AND NOT EXISTS (
          SELECT 1 FROM public.finance_financial_connections connection
          WHERE connection.bank_account_id = bank.id AND connection.ngo_id = _ngo_id
            AND connection.status = 'active'
        );
      provider_ready := unconnected_banks = 0;
    END IF;
  END IF;

  checks := jsonb_build_array(
    jsonb_build_object('key','configuration','label','Cutover configuration saved','passed',certification.id IS NOT NULL,'blocking',true),
    jsonb_build_object('key','chart_of_accounts','label','NGO chart of accounts activated and approved','passed',active_accounts > 0 AND COALESCE(certification.coa_approved,false),'blocking',true,'detail',active_accounts || ' active accounts'),
    jsonb_build_object('key','opening_balances','label','Opening balances posted with evidence or zero-balance start attested','passed',opening_ready,'blocking',true),
    jsonb_build_object('key','bank_reconciliation','label','Every active bank is reconciled through cutover','passed',active_banks > 0 AND unreconciled_banks = 0,'blocking',true,'detail',unreconciled_banks || ' unreconciled of ' || active_banks),
    jsonb_build_object('key','parallel_close','label','Prior-system parallel close matched and approved','passed',parallel_ready,'blocking',true),
    jsonb_build_object('key','accounting_integrity','label','Live accounting ecosystem remains balanced','passed',ecosystem_ready,'blocking',true),
    jsonb_build_object('key','operating_controls','label','Funds, AP/AR, access, receipts, and historical archive reviewed','passed',operating_controls_ready,'blocking',true),
    jsonb_build_object('key','accountant_signoff','label','Accountant attestation and signed evidence attached','passed',signoff_ready,'blocking',true),
    jsonb_build_object('key','bank_data_path','label','Bank-data operating path is ready','passed',provider_ready,'blocking',true,'detail',COALESCE(certification.bank_data_mode,'not selected'))
  );
  SELECT COALESCE(jsonb_agg(item->>'label'),'[]'::jsonb) INTO blockers
  FROM jsonb_array_elements(checks) item
  WHERE COALESCE((item->>'blocking')::boolean,false)
    AND NOT COALESCE((item->>'passed')::boolean,false);
  ready := jsonb_array_length(blockers) = 0;

  RETURN jsonb_build_object(
    'ngo_id', _ngo_id, 'certification_id', certification.id,
    'status', COALESCE(certification.status,'not_started'),
    'is_ready', ready, 'is_system_of_record', certification.status = 'live',
    'cutover_date', certification.cutover_date,
    'checks', checks, 'blockers', blockers, 'checked_at', now()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.save_finance_go_live_certification(
  _ngo_id uuid,
  _payload jsonb
)
RETURNS public.finance_go_live_certifications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  certification public.finance_go_live_certifications;
  comparison public.finance_parallel_close_comparisons;
  readiness jsonb;
  comparison_id uuid := NULLIF(_payload->>'parallel_close_id','')::uuid;
  signoff_document_id uuid := NULLIF(_payload->>'accountant_signoff_document_id','')::uuid;
  signed boolean := COALESCE((_payload->>'accountant_signed')::boolean,false);
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_finance_ledger_manager() THEN
    RAISE EXCEPTION 'Finance manager access required';
  END IF;
  SELECT * INTO certification FROM public.finance_go_live_certifications
  WHERE ngo_id = _ngo_id FOR UPDATE;
  IF certification.status = 'live' THEN RAISE EXCEPTION 'Live certification is locked; suspend it with a reason before changing cutover evidence'; END IF;
  IF comparison_id IS NOT NULL THEN
    SELECT * INTO comparison FROM public.finance_parallel_close_comparisons
    WHERE id = comparison_id AND ngo_id = _ngo_id;
    IF comparison.id IS NULL THEN RAISE EXCEPTION 'Parallel close comparison does not belong to the selected NGO'; END IF;
  END IF;
  IF signoff_document_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.documents document
    WHERE document.id = signoff_document_id AND document.ngo_id = _ngo_id
  ) THEN RAISE EXCEPTION 'Accountant signoff document must belong to the selected NGO'; END IF;
  IF signed AND (
    NULLIF(trim(_payload->>'accountant_name'),'') IS NULL
    OR NULLIF(trim(_payload->>'accountant_attestation'),'') IS NULL
    OR signoff_document_id IS NULL
  ) THEN RAISE EXCEPTION 'Accountant name, attestation, and signed evidence are required'; END IF;

  IF certification.id IS NULL THEN
    INSERT INTO public.finance_go_live_certifications (
      ngo_id, cutover_date, opening_balance_mode, zero_balance_attested,
      bank_data_mode, parallel_close_id, coa_approved, restricted_funds_reviewed,
      ap_ar_reviewed, access_reviewed, receipt_workflow_verified,
      historical_archive_retained, accountant_name, accountant_credential,
      accountant_attestation, accountant_signoff_document_id,
      accountant_signed_at, created_by_user_id
    ) VALUES (
      _ngo_id, (_payload->>'cutover_date')::date,
      COALESCE(NULLIF(_payload->>'opening_balance_mode',''),'imported'),
      COALESCE((_payload->>'zero_balance_attested')::boolean,false),
      COALESCE(NULLIF(_payload->>'bank_data_mode',''),'manual_csv'), comparison_id,
      COALESCE((_payload->>'coa_approved')::boolean,false),
      COALESCE((_payload->>'restricted_funds_reviewed')::boolean,false),
      COALESCE((_payload->>'ap_ar_reviewed')::boolean,false),
      COALESCE((_payload->>'access_reviewed')::boolean,false),
      COALESCE((_payload->>'receipt_workflow_verified')::boolean,false),
      COALESCE((_payload->>'historical_archive_retained')::boolean,false),
      NULLIF(trim(_payload->>'accountant_name'),''),
      NULLIF(trim(_payload->>'accountant_credential'),''),
      NULLIF(trim(_payload->>'accountant_attestation'),''), signoff_document_id,
      CASE WHEN signed THEN now() ELSE NULL END, auth.uid()
    ) RETURNING * INTO certification;
  ELSE
    UPDATE public.finance_go_live_certifications SET
      cutover_date = COALESCE(NULLIF(_payload->>'cutover_date','')::date, cutover_date),
      opening_balance_mode = COALESCE(NULLIF(_payload->>'opening_balance_mode',''), opening_balance_mode),
      zero_balance_attested = COALESCE((_payload->>'zero_balance_attested')::boolean, zero_balance_attested),
      bank_data_mode = COALESCE(NULLIF(_payload->>'bank_data_mode',''), bank_data_mode),
      parallel_close_id = comparison_id,
      coa_approved = COALESCE((_payload->>'coa_approved')::boolean, coa_approved),
      restricted_funds_reviewed = COALESCE((_payload->>'restricted_funds_reviewed')::boolean, restricted_funds_reviewed),
      ap_ar_reviewed = COALESCE((_payload->>'ap_ar_reviewed')::boolean, ap_ar_reviewed),
      access_reviewed = COALESCE((_payload->>'access_reviewed')::boolean, access_reviewed),
      receipt_workflow_verified = COALESCE((_payload->>'receipt_workflow_verified')::boolean, receipt_workflow_verified),
      historical_archive_retained = COALESCE((_payload->>'historical_archive_retained')::boolean, historical_archive_retained),
      accountant_name = NULLIF(trim(_payload->>'accountant_name'),''),
      accountant_credential = NULLIF(trim(_payload->>'accountant_credential'),''),
      accountant_attestation = NULLIF(trim(_payload->>'accountant_attestation'),''),
      accountant_signoff_document_id = signoff_document_id,
      accountant_signed_at = CASE WHEN signed THEN COALESCE(accountant_signed_at,now()) ELSE NULL END,
      activated_by_user_id = NULL, activated_at = NULL,
      suspended_by_user_id = NULL, suspended_at = NULL, suspension_reason = NULL,
      updated_at = now()
    WHERE id = certification.id RETURNING * INTO certification;
  END IF;

  readiness := public.finance_go_live_readiness(_ngo_id);
  UPDATE public.finance_go_live_certifications
  SET status = CASE WHEN COALESCE((readiness->>'is_ready')::boolean,false) THEN 'ready' ELSE 'draft' END,
      readiness_snapshot = readiness, updated_at = now()
  WHERE id = certification.id RETURNING * INTO certification;
  PERFORM public.finance_log_audit_event(
    'finance_go_live_certification', certification.id, 'saved',
    jsonb_build_object('ngo_id', _ngo_id, 'cutover_date', certification.cutover_date,
      'status', certification.status, 'blockers', readiness->'blockers')
  );
  RETURN certification;
END;
$$;

CREATE OR REPLACE FUNCTION public.activate_finance_system_of_record(_ngo_id uuid)
RETURNS public.finance_go_live_certifications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE certification public.finance_go_live_certifications; readiness jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_finance_ledger_manager() THEN
    RAISE EXCEPTION 'Finance manager access required';
  END IF;
  SELECT * INTO certification FROM public.finance_go_live_certifications
  WHERE ngo_id = _ngo_id FOR UPDATE;
  IF certification.id IS NULL THEN RAISE EXCEPTION 'Save the go-live certification first'; END IF;
  IF certification.status = 'live' THEN RETURN certification; END IF;
  readiness := public.finance_go_live_readiness(_ngo_id);
  IF NOT COALESCE((readiness->>'is_ready')::boolean,false) THEN
    RAISE EXCEPTION 'Go-live is blocked: %', readiness->'blockers';
  END IF;
  UPDATE public.finance_go_live_certifications
  SET status = 'live', readiness_snapshot = readiness,
      activated_by_user_id = auth.uid(), activated_at = now(), updated_at = now()
  WHERE id = certification.id RETURNING * INTO certification;
  PERFORM public.finance_log_audit_event(
    'finance_go_live_certification', certification.id, 'activated_system_of_record',
    jsonb_build_object('ngo_id', _ngo_id, 'cutover_date', certification.cutover_date,
      'parallel_close_id', certification.parallel_close_id)
  );
  RETURN certification;
END;
$$;

CREATE OR REPLACE FUNCTION public.suspend_finance_system_of_record(_ngo_id uuid, _reason text)
RETURNS public.finance_go_live_certifications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE certification public.finance_go_live_certifications;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_finance_ledger_manager() THEN
    RAISE EXCEPTION 'Finance manager access required';
  END IF;
  IF NULLIF(trim(_reason),'') IS NULL THEN RAISE EXCEPTION 'Suspension reason is required'; END IF;
  UPDATE public.finance_go_live_certifications SET
    status = 'suspended', suspended_by_user_id = auth.uid(), suspended_at = now(),
    suspension_reason = trim(_reason), updated_at = now()
  WHERE ngo_id = _ngo_id AND status = 'live' RETURNING * INTO certification;
  IF certification.id IS NULL THEN RAISE EXCEPTION 'No live system-of-record certification found'; END IF;
  PERFORM public.finance_log_audit_event(
    'finance_go_live_certification', certification.id, 'suspended_system_of_record',
    jsonb_build_object('ngo_id', _ngo_id, 'reason', trim(_reason))
  );
  RETURN certification;
END;
$$;

REVOKE ALL ON FUNCTION public.finance_compare_cutover_metrics(jsonb, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.finance_cutover_system_metrics(uuid, date, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.save_finance_parallel_close(uuid, date, date, text, uuid, jsonb, numeric, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.approve_finance_parallel_close(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.finance_go_live_readiness(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.save_finance_go_live_certification(uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.activate_finance_system_of_record(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.suspend_finance_system_of_record(uuid, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.finance_cutover_system_metrics(uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_finance_parallel_close(uuid, date, date, text, uuid, jsonb, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_finance_parallel_close(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finance_go_live_readiness(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_finance_go_live_certification(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.activate_finance_system_of_record(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.suspend_finance_system_of_record(uuid, text) TO authenticated;
