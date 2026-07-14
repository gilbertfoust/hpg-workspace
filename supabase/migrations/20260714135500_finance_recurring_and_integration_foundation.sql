-- Phase 16: Safe automation and provider-neutral integration foundations. Recurring
-- rules create reviewable drafts; external bank/payment providers use a
-- durable, idempotent outbox and never bypass the authoritative ledger.

CREATE TABLE public.finance_recurring_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ngo_id uuid NOT NULL REFERENCES public.ngos(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (trim(name) <> ''),
  transaction_kind text NOT NULL DEFAULT 'journal' CHECK (transaction_kind IN ('journal')),
  cadence text NOT NULL CHECK (cadence IN ('weekly','monthly','quarterly','annual')),
  interval_count integer NOT NULL DEFAULT 1 CHECK (interval_count > 0),
  start_date date NOT NULL,
  end_date date,
  next_run_on date NOT NULL,
  template_json jsonb NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','ended')),
  last_generated_at timestamptz,
  created_by_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT finance_recurring_rule_dates CHECK (end_date IS NULL OR end_date >= start_date),
  CONSTRAINT finance_recurring_template_object CHECK (jsonb_typeof(template_json) = 'object')
);

CREATE TABLE public.finance_recurring_occurrences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id uuid NOT NULL REFERENCES public.finance_recurring_rules(id) ON DELETE CASCADE,
  ngo_id uuid NOT NULL REFERENCES public.ngos(id) ON DELETE CASCADE,
  occurrence_date date NOT NULL,
  status text NOT NULL CHECK (status IN ('draft_generated','skipped','failed')),
  entity_type text,
  entity_id uuid,
  journal_entry_id uuid REFERENCES public.finance_journal_entries(id) ON DELETE RESTRICT,
  error_message text,
  created_by_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT finance_recurring_occurrence_unique UNIQUE (rule_id, occurrence_date)
);

CREATE INDEX idx_finance_recurring_rules_due
  ON public.finance_recurring_rules(status, next_run_on, ngo_id);
CREATE INDEX idx_finance_recurring_occurrences_rule
  ON public.finance_recurring_occurrences(rule_id, occurrence_date DESC);

CREATE TABLE public.finance_financial_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ngo_id uuid NOT NULL REFERENCES public.ngos(id) ON DELETE CASCADE,
  bank_account_id uuid NOT NULL REFERENCES public.finance_bank_accounts(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (trim(provider) <> ''),
  external_connection_id text,
  secret_reference text,
  institution_name text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','reauthorization_required','disabled','error')),
  last_synced_at timestamptz,
  last_error text,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT finance_financial_connection_unique UNIQUE (provider, external_connection_id),
  CONSTRAINT finance_connection_secret_is_reference CHECK (
    secret_reference IS NULL OR secret_reference !~* '(access[_-]?token|bearer\s+|secret\s*=)'
  )
);

CREATE TABLE public.finance_feed_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES public.finance_financial_connections(id) ON DELETE CASCADE,
  ngo_id uuid NOT NULL REFERENCES public.ngos(id) ON DELETE CASCADE,
  requested_from date,
  requested_through date,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','succeeded','failed','canceled')),
  imported_count integer NOT NULL DEFAULT 0,
  duplicate_count integer NOT NULL DEFAULT 0,
  statement_import_id uuid REFERENCES public.finance_bank_statement_imports(id) ON DELETE SET NULL,
  provider_cursor text,
  error_message text,
  requested_by_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.finance_payment_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ngo_id uuid NOT NULL REFERENCES public.ngos(id) ON DELETE CASCADE,
  payment_id uuid NOT NULL REFERENCES public.finance_payments(id) ON DELETE RESTRICT,
  provider text NOT NULL CHECK (trim(provider) <> ''),
  idempotency_key text NOT NULL UNIQUE,
  amount numeric(18,2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'USD' CHECK (currency ~ '^[A-Z]{3}$'),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','submitted','processing','settled','failed','canceled')),
  provider_reference text,
  failure_message text,
  requested_by_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  submitted_at timestamptz,
  settled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT finance_payment_intent_payment_unique UNIQUE (payment_id)
);

CREATE TABLE public.finance_integration_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ngo_id uuid NOT NULL REFERENCES public.ngos(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('bank_feed_sync_requested','payment_submission_requested')),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','sent','failed','canceled')),
  attempt_count integer NOT NULL DEFAULT 0,
  available_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_finance_feed_sync_runs_status ON public.finance_feed_sync_runs(status, created_at);
CREATE INDEX idx_finance_payment_intents_status ON public.finance_payment_intents(status, created_at);
CREATE INDEX idx_finance_integration_outbox_delivery
  ON public.finance_integration_outbox(status, available_at, created_at);

CREATE TRIGGER trg_finance_recurring_rules_updated_at
  BEFORE UPDATE ON public.finance_recurring_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_finance_financial_connections_updated_at
  BEFORE UPDATE ON public.finance_financial_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_finance_payment_intents_updated_at
  BEFORE UPDATE ON public.finance_payment_intents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_finance_integration_outbox_updated_at
  BEFORE UPDATE ON public.finance_integration_outbox
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.finance_recurring_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_recurring_occurrences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_financial_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_feed_sync_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_payment_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_integration_outbox ENABLE ROW LEVEL SECURITY;

CREATE POLICY "finance recurring rules read" ON public.finance_recurring_rules
  FOR SELECT TO authenticated USING (public.can_read_finance_ledger());
CREATE POLICY "finance recurring rules manage" ON public.finance_recurring_rules
  FOR ALL TO authenticated USING (public.is_finance_ledger_manager()) WITH CHECK (public.is_finance_ledger_manager());
CREATE POLICY "finance recurring occurrences read" ON public.finance_recurring_occurrences
  FOR SELECT TO authenticated USING (public.can_read_finance_ledger());
CREATE POLICY "finance recurring occurrences manage" ON public.finance_recurring_occurrences
  FOR ALL TO authenticated USING (public.is_finance_ledger_manager()) WITH CHECK (public.is_finance_ledger_manager());
CREATE POLICY "finance financial connections read" ON public.finance_financial_connections
  FOR SELECT TO authenticated USING (public.can_read_finance_ledger());
CREATE POLICY "finance financial connections manage" ON public.finance_financial_connections
  FOR ALL TO authenticated USING (public.is_finance_ledger_manager()) WITH CHECK (public.is_finance_ledger_manager());
CREATE POLICY "finance feed sync runs read" ON public.finance_feed_sync_runs
  FOR SELECT TO authenticated USING (public.can_read_finance_ledger());
CREATE POLICY "finance feed sync runs manage" ON public.finance_feed_sync_runs
  FOR ALL TO authenticated USING (public.is_finance_ledger_manager()) WITH CHECK (public.is_finance_ledger_manager());
CREATE POLICY "finance payment intents read" ON public.finance_payment_intents
  FOR SELECT TO authenticated USING (public.can_read_finance_ledger());
CREATE POLICY "finance payment intents manage" ON public.finance_payment_intents
  FOR ALL TO authenticated USING (public.is_finance_ledger_manager()) WITH CHECK (public.is_finance_ledger_manager());
CREATE POLICY "finance integration outbox read" ON public.finance_integration_outbox
  FOR SELECT TO authenticated USING (public.is_finance_ledger_manager());
CREATE POLICY "finance integration outbox manage" ON public.finance_integration_outbox
  FOR ALL TO authenticated USING (public.is_finance_ledger_manager()) WITH CHECK (public.is_finance_ledger_manager());

GRANT SELECT ON public.finance_recurring_rules, public.finance_recurring_occurrences,
  public.finance_financial_connections, public.finance_feed_sync_runs,
  public.finance_payment_intents, public.finance_integration_outbox TO authenticated;

CREATE OR REPLACE FUNCTION public.finance_next_recurring_date(
  _current date,
  _cadence text,
  _interval_count integer
)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  RETURN CASE _cadence
    WHEN 'weekly' THEN _current + (7 * _interval_count)
    WHEN 'monthly' THEN (_current + make_interval(months => _interval_count))::date
    WHEN 'quarterly' THEN (_current + make_interval(months => 3 * _interval_count))::date
    WHEN 'annual' THEN (_current + make_interval(years => _interval_count))::date
    ELSE NULL END;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_finance_recurring_rule(
  _rule_id uuid DEFAULT NULL,
  _header jsonb DEFAULT '{}'::jsonb,
  _template jsonb DEFAULT '{}'::jsonb
)
RETURNS public.finance_recurring_rules
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE rule public.finance_recurring_rules; line jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_finance_ledger_manager() THEN RAISE EXCEPTION 'Finance manager access required'; END IF;
  IF jsonb_typeof(_template) <> 'object' OR jsonb_typeof(COALESCE(_template->'lines','[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'Recurring journal template must include a lines array';
  END IF;
  IF _rule_id IS NULL THEN
    INSERT INTO public.finance_recurring_rules (
      ngo_id, name, cadence, interval_count, start_date, end_date,
      next_run_on, template_json, status, created_by_user_id
    ) VALUES (
      NULLIF(_header->>'ngo_id','')::uuid,
      NULLIF(trim(_header->>'name'),''),
      _header->>'cadence', COALESCE(NULLIF(_header->>'interval_count','')::integer,1),
      (_header->>'start_date')::date, NULLIF(_header->>'end_date','')::date,
      COALESCE(NULLIF(_header->>'next_run_on','')::date, (_header->>'start_date')::date),
      _template, COALESCE(NULLIF(_header->>'status',''),'active'), auth.uid()
    ) RETURNING * INTO rule;
  ELSE
    SELECT * INTO rule FROM public.finance_recurring_rules WHERE id = _rule_id FOR UPDATE;
    IF rule.id IS NULL THEN RAISE EXCEPTION 'Recurring rule not found'; END IF;
    UPDATE public.finance_recurring_rules
    SET name = COALESCE(NULLIF(trim(_header->>'name'),''), rule.name),
        cadence = COALESCE(NULLIF(_header->>'cadence',''), rule.cadence),
        interval_count = COALESCE(NULLIF(_header->>'interval_count','')::integer, rule.interval_count),
        end_date = CASE WHEN _header ? 'end_date' THEN NULLIF(_header->>'end_date','')::date ELSE rule.end_date END,
        next_run_on = COALESCE(NULLIF(_header->>'next_run_on','')::date, rule.next_run_on),
        template_json = _template,
        status = COALESCE(NULLIF(_header->>'status',''), rule.status), updated_at = now()
    WHERE id = rule.id RETURNING * INTO rule;
  END IF;

  FOR line IN SELECT value FROM jsonb_array_elements(_template->'lines') LOOP
    PERFORM public.ensure_finance_ngo_account(
      rule.ngo_id, NULLIF(line->>'account_id','')::uuid, line, 'recurring_rule', rule.id
    );
  END LOOP;
  PERFORM public.finance_log_audit_event(
    'finance_recurring_rule', rule.id, CASE WHEN _rule_id IS NULL THEN 'created' ELSE 'updated' END,
    jsonb_build_object('ngo_id', rule.ngo_id, 'cadence', rule.cadence, 'next_run_on', rule.next_run_on)
  );
  RETURN rule;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_due_finance_recurring_drafts(_as_of date DEFAULT CURRENT_DATE)
RETURNS SETOF public.finance_recurring_occurrences
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE rule public.finance_recurring_rules; occurrence public.finance_recurring_occurrences;
  entry public.finance_journal_entries; generated_date date;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_finance_ledger_manager() THEN RAISE EXCEPTION 'Finance manager access required'; END IF;
  FOR rule IN
    SELECT * FROM public.finance_recurring_rules
    WHERE status = 'active' AND next_run_on <= _as_of
      AND (end_date IS NULL OR next_run_on <= end_date)
    ORDER BY next_run_on, id FOR UPDATE SKIP LOCKED
  LOOP
    generated_date := rule.next_run_on;
    IF NOT EXISTS (
      SELECT 1 FROM public.finance_recurring_occurrences existing
      WHERE existing.rule_id = rule.id AND existing.occurrence_date = generated_date
    ) THEN
      BEGIN
        entry := public.save_finance_journal_entry(
          NULL, generated_date,
          COALESCE(NULLIF(rule.template_json->>'memo',''), rule.name),
          'finance_recurring_rule', rule.id, NULL, rule.ngo_id,
          COALESCE(rule.template_json->'lines','[]'::jsonb)
        );
        INSERT INTO public.finance_recurring_occurrences (
          rule_id, ngo_id, occurrence_date, status, entity_type,
          entity_id, journal_entry_id, created_by_user_id
        ) VALUES (
          rule.id, rule.ngo_id, generated_date, 'draft_generated',
          'journal_entry', entry.id, entry.id, auth.uid()
        ) RETURNING * INTO occurrence;
      EXCEPTION WHEN OTHERS THEN
        INSERT INTO public.finance_recurring_occurrences (
          rule_id, ngo_id, occurrence_date, status, error_message, created_by_user_id
        ) VALUES (rule.id, rule.ngo_id, generated_date, 'failed', SQLERRM, auth.uid())
        ON CONFLICT (rule_id, occurrence_date) DO UPDATE
        SET status = 'failed', error_message = EXCLUDED.error_message
        RETURNING * INTO occurrence;
      END;
      RETURN NEXT occurrence;
    END IF;

    UPDATE public.finance_recurring_rules
    SET last_generated_at = now(),
        next_run_on = public.finance_next_recurring_date(generated_date, cadence, interval_count),
        status = CASE WHEN end_date IS NOT NULL
          AND public.finance_next_recurring_date(generated_date, cadence, interval_count) > end_date
          THEN 'ended' ELSE status END,
        updated_at = now()
    WHERE id = rule.id;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.queue_finance_feed_sync(
  _connection_id uuid,
  _from date DEFAULT NULL,
  _through date DEFAULT CURRENT_DATE
)
RETURNS public.finance_feed_sync_runs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE connection public.finance_financial_connections; run public.finance_feed_sync_runs; key text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_finance_ledger_manager() THEN RAISE EXCEPTION 'Finance manager access required'; END IF;
  SELECT * INTO connection FROM public.finance_financial_connections WHERE id = _connection_id FOR UPDATE;
  IF connection.id IS NULL OR connection.status <> 'active' THEN RAISE EXCEPTION 'Active financial connection required'; END IF;
  IF _from IS NOT NULL AND _through < _from THEN RAISE EXCEPTION 'Sync date range is invalid'; END IF;
  INSERT INTO public.finance_feed_sync_runs (
    connection_id, ngo_id, requested_from, requested_through, requested_by_user_id
  ) VALUES (connection.id, connection.ngo_id, _from, _through, auth.uid())
  RETURNING * INTO run;
  key := 'bank-sync:' || run.id::text;
  INSERT INTO public.finance_integration_outbox (
    ngo_id, event_type, entity_type, entity_id, idempotency_key, payload_json
  ) VALUES (
    connection.ngo_id, 'bank_feed_sync_requested', 'finance_feed_sync_run', run.id, key,
    jsonb_build_object('connection_id', connection.id, 'provider', connection.provider,
      'from', _from, 'through', _through)
  );
  PERFORM public.finance_log_audit_event('finance_feed_sync_run', run.id, 'queued',
    jsonb_build_object('ngo_id', run.ngo_id, 'connection_id', connection.id));
  RETURN run;
END;
$$;

CREATE OR REPLACE FUNCTION public.queue_finance_payment_intent(
  _payment_id uuid,
  _provider text,
  _currency text DEFAULT 'USD'
)
RETURNS public.finance_payment_intents
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE payment public.finance_payments; intent public.finance_payment_intents; key text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_finance_ledger_manager() THEN RAISE EXCEPTION 'Finance manager access required'; END IF;
  SELECT * INTO payment FROM public.finance_payments WHERE id = _payment_id FOR UPDATE;
  IF payment.id IS NULL OR payment.status NOT IN ('draft','pending_approval') THEN
    RAISE EXCEPTION 'A draft or approved payment is required before money movement';
  END IF;
  IF payment.ngo_id IS NULL THEN RAISE EXCEPTION 'Payment must belong to an NGO'; END IF;
  key := 'payment:' || payment.id::text;
  INSERT INTO public.finance_payment_intents (
    ngo_id, payment_id, provider, idempotency_key, amount, currency, requested_by_user_id
  ) VALUES (
    payment.ngo_id, payment.id, trim(_provider), key, payment.amount, upper(_currency), auth.uid()
  ) RETURNING * INTO intent;
  INSERT INTO public.finance_integration_outbox (
    ngo_id, event_type, entity_type, entity_id, idempotency_key, payload_json
  ) VALUES (
    payment.ngo_id, 'payment_submission_requested', 'finance_payment_intent', intent.id, key,
    jsonb_build_object('payment_id', payment.id, 'provider', intent.provider,
      'amount', intent.amount, 'currency', intent.currency)
  );
  PERFORM public.finance_log_audit_event('finance_payment_intent', intent.id, 'queued',
    jsonb_build_object('ngo_id', intent.ngo_id, 'payment_id', payment.id, 'provider', intent.provider));
  RETURN intent;
END;
$$;

CREATE OR REPLACE FUNCTION public.settle_finance_payment_intent(
  _intent_id uuid,
  _provider_reference text
)
RETURNS public.finance_payment_intents
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE intent public.finance_payment_intents; payment public.finance_payments;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_finance_ledger_manager() THEN RAISE EXCEPTION 'Finance manager access required'; END IF;
  IF NULLIF(trim(_provider_reference),'') IS NULL THEN RAISE EXCEPTION 'Provider settlement reference is required'; END IF;
  SELECT * INTO intent FROM public.finance_payment_intents WHERE id = _intent_id FOR UPDATE;
  IF intent.id IS NULL OR intent.status NOT IN ('queued','submitted','processing') THEN RAISE EXCEPTION 'Payment intent is not settleable'; END IF;
  payment := public.post_finance_payment(intent.payment_id);
  UPDATE public.finance_payment_intents
  SET status = 'settled', provider_reference = trim(_provider_reference),
      settled_at = now(), updated_at = now()
  WHERE id = intent.id RETURNING * INTO intent;
  UPDATE public.finance_integration_outbox SET status = 'sent', updated_at = now()
  WHERE entity_type = 'finance_payment_intent' AND entity_id = intent.id;
  PERFORM public.finance_log_audit_event('finance_payment_intent', intent.id, 'settled',
    jsonb_build_object('provider_reference', intent.provider_reference,
      'payment_id', payment.id, 'journal_entry_id', payment.journal_entry_id));
  RETURN intent;
END;
$$;

REVOKE ALL ON FUNCTION public.finance_next_recurring_date(date, text, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.save_finance_recurring_rule(uuid, jsonb, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.generate_due_finance_recurring_drafts(date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.queue_finance_feed_sync(uuid, date, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.queue_finance_payment_intent(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.settle_finance_payment_intent(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_finance_recurring_rule(uuid, jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_due_finance_recurring_drafts(date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.queue_finance_feed_sync(uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.queue_finance_payment_intent(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.settle_finance_payment_intent(uuid, text) TO authenticated;
