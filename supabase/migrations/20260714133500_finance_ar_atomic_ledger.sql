-- Phase 14: Make accounts receivable part of the same authoritative NGO ledger.
-- Invoice issue, cash receipt, write-off, and reversal each create balanced,
-- immutable journal activity in the same database transaction.

CREATE SEQUENCE IF NOT EXISTS public.finance_invoice_number_seq;

ALTER TABLE public.finance_invoices
  ADD COLUMN IF NOT EXISTS receivable_account_id uuid REFERENCES public.finance_accounts(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS issued_at timestamptz,
  ADD COLUMN IF NOT EXISTS voided_at timestamptz,
  ADD COLUMN IF NOT EXISTS void_reason text;

ALTER TABLE public.finance_invoice_payments
  ADD COLUMN IF NOT EXISTS ngo_id uuid REFERENCES public.ngos(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS bank_account_id uuid REFERENCES public.finance_bank_accounts(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL;

CREATE TABLE public.finance_invoice_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.finance_invoices(id) ON DELETE RESTRICT,
  ngo_id uuid NOT NULL REFERENCES public.ngos(id) ON DELETE RESTRICT,
  adjustment_date date NOT NULL DEFAULT CURRENT_DATE,
  adjustment_type text NOT NULL CHECK (adjustment_type IN ('write_off')),
  amount numeric(18,2) NOT NULL CHECK (amount > 0),
  reason text NOT NULL CHECK (trim(reason) <> ''),
  journal_entry_id uuid NOT NULL REFERENCES public.finance_journal_entries(id) ON DELETE RESTRICT,
  created_by_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_finance_invoice_adjustments_invoice
  ON public.finance_invoice_adjustments(invoice_id, adjustment_date);
CREATE INDEX IF NOT EXISTS idx_finance_invoices_ngo_status
  ON public.finance_invoices(ngo_id, status, due_date);
CREATE INDEX IF NOT EXISTS idx_finance_invoice_payments_ngo_date
  ON public.finance_invoice_payments(ngo_id, payment_date);

ALTER TABLE public.finance_invoice_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "finance invoice adjustments read"
  ON public.finance_invoice_adjustments FOR SELECT TO authenticated
  USING (public.can_read_finance_ledger());
CREATE POLICY "finance invoice adjustments manage"
  ON public.finance_invoice_adjustments FOR ALL TO authenticated
  USING (public.is_finance_ledger_manager())
  WITH CHECK (public.is_finance_ledger_manager());

GRANT SELECT ON public.finance_invoice_adjustments TO authenticated;

INSERT INTO public.finance_accounts (
  code, name, account_type, account_subtype, normal_balance, is_active,
  entity_scope, financial_statement_line
) VALUES
  ('1100', 'Accounts Receivable', 'asset', 'receivable', 'debit', true,
    'fiscal_sponsorship', 'assets'),
  ('6900', 'Bad Debt Expense', 'expense', 'bad_debt', 'debit', true,
    'fiscal_sponsorship', 'expenses')
ON CONFLICT (code) DO UPDATE SET is_active = true, updated_at = now();

CREATE OR REPLACE FUNCTION public.finance_resolve_accounts_receivable_account_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.finance_accounts
  WHERE is_active AND account_type = 'asset'
    AND (code = '1100' OR account_subtype IN ('receivable', 'accounts_receivable'))
  ORDER BY CASE WHEN code = '1100' THEN 0 ELSE 1 END, code
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.finance_resolve_bad_debt_account_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.finance_accounts
  WHERE is_active AND account_type = 'expense'
    AND (code = '6900' OR account_subtype = 'bad_debt')
  ORDER BY CASE WHEN code = '6900' THEN 0 ELSE 1 END, code
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.finance_resolve_accounts_receivable_account_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.finance_resolve_bad_debt_account_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finance_resolve_accounts_receivable_account_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.finance_resolve_bad_debt_account_id() TO authenticated;

CREATE OR REPLACE FUNCTION public.finance_validate_invoice_line_entity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE invoice_ngo_id uuid;
BEGIN
  SELECT ngo_id INTO invoice_ngo_id FROM public.finance_invoices WHERE id = NEW.invoice_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invoice not found'; END IF;
  IF NEW.ngo_id IS DISTINCT FROM invoice_ngo_id THEN
    RAISE EXCEPTION 'Every invoice line must belong to the invoice NGO';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_finance_validate_invoice_line_entity ON public.finance_invoice_lines;
CREATE TRIGGER trg_finance_validate_invoice_line_entity
  BEFORE INSERT OR UPDATE ON public.finance_invoice_lines
  FOR EACH ROW EXECUTE FUNCTION public.finance_validate_invoice_line_entity();

CREATE OR REPLACE FUNCTION public.finance_guard_issued_invoice()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' AND OLD.status <> 'draft' THEN
    RAISE EXCEPTION 'Only draft invoices can be deleted';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status <> 'draft' THEN
    IF NEW.ngo_id IS DISTINCT FROM OLD.ngo_id
      OR NEW.invoice_date IS DISTINCT FROM OLD.invoice_date
      OR NEW.due_date IS DISTINCT FROM OLD.due_date
      OR NEW.total IS DISTINCT FROM OLD.total
      OR NEW.receivable_account_id IS DISTINCT FROM OLD.receivable_account_id
      OR NEW.journal_entry_id IS DISTINCT FROM OLD.journal_entry_id THEN
      -- Status and cumulative settlement fields are mutated only by protected RPCs.
      IF current_setting('hpg.finance_ar_rpc', true) IS DISTINCT FROM 'on' THEN
        RAISE EXCEPTION 'Issued invoices are immutable; use payment, write-off, or void workflows';
      END IF;
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_finance_guard_issued_invoice ON public.finance_invoices;
CREATE TRIGGER trg_finance_guard_issued_invoice
  BEFORE UPDATE OR DELETE ON public.finance_invoices
  FOR EACH ROW EXECUTE FUNCTION public.finance_guard_issued_invoice();

CREATE OR REPLACE FUNCTION public.finance_guard_issued_invoice_line()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE invoice_status public.finance_invoice_status;
BEGIN
  SELECT status INTO invoice_status
  FROM public.finance_invoices WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);
  IF invoice_status <> 'draft' THEN RAISE EXCEPTION 'Invoice lines are immutable after issue'; END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_finance_guard_issued_invoice_line ON public.finance_invoice_lines;
CREATE TRIGGER trg_finance_guard_issued_invoice_line
  BEFORE INSERT OR UPDATE OR DELETE ON public.finance_invoice_lines
  FOR EACH ROW EXECUTE FUNCTION public.finance_guard_issued_invoice_line();

CREATE OR REPLACE FUNCTION public.save_finance_invoice(
  _invoice_id uuid DEFAULT NULL,
  _header jsonb DEFAULT '{}'::jsonb,
  _lines jsonb DEFAULT '[]'::jsonb
)
RETURNS public.finance_invoices
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  invoice public.finance_invoices;
  line jsonb;
  line_number integer := 0;
  revenue_account_id uuid;
  selected_ngo_id uuid;
  invoice_total numeric(18,2);
  generated_number text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_finance_staff() THEN RAISE EXCEPTION 'Finance staff access required'; END IF;
  IF jsonb_typeof(COALESCE(_lines, '[]'::jsonb)) <> 'array' THEN RAISE EXCEPTION 'Invoice lines must be an array'; END IF;

  IF _invoice_id IS NULL THEN
    selected_ngo_id := NULLIF(_header->>'ngo_id', '')::uuid;
    IF selected_ngo_id IS NULL THEN RAISE EXCEPTION 'Select an NGO before creating an invoice'; END IF;
    generated_number := COALESCE(
      NULLIF(trim(_header->>'invoice_number'), ''),
      'INV-' || to_char(COALESCE(NULLIF(_header->>'invoice_date', '')::date, CURRENT_DATE), 'YYYY') || '-' ||
        lpad(nextval('public.finance_invoice_number_seq')::text, 6, '0')
    );
    INSERT INTO public.finance_invoices (
      invoice_number, donor_id, customer_name, ngo_id, grant_application_id,
      invoice_date, due_date, status, subtotal, total, memo,
      document_id, created_by_user_id
    ) VALUES (
      generated_number,
      NULLIF(_header->>'donor_id', '')::uuid,
      NULLIF(trim(_header->>'customer_name'), ''),
      selected_ngo_id,
      NULLIF(_header->>'grant_application_id', '')::uuid,
      COALESCE(NULLIF(_header->>'invoice_date', '')::date, CURRENT_DATE),
      NULLIF(_header->>'due_date', '')::date,
      'draft', 0, 0, NULLIF(trim(_header->>'memo'), ''),
      NULLIF(_header->>'document_id', '')::uuid, auth.uid()
    ) RETURNING * INTO invoice;
  ELSE
    SELECT * INTO invoice FROM public.finance_invoices WHERE id = _invoice_id FOR UPDATE;
    IF invoice.id IS NULL THEN RAISE EXCEPTION 'Invoice not found'; END IF;
    IF invoice.status <> 'draft' THEN RAISE EXCEPTION 'Only draft invoices can be edited'; END IF;
    UPDATE public.finance_invoices
    SET invoice_number = COALESCE(NULLIF(trim(_header->>'invoice_number'), ''), invoice.invoice_number),
        donor_id = CASE WHEN _header ? 'donor_id' THEN NULLIF(_header->>'donor_id', '')::uuid ELSE invoice.donor_id END,
        customer_name = CASE WHEN _header ? 'customer_name' THEN NULLIF(trim(_header->>'customer_name'), '') ELSE invoice.customer_name END,
        grant_application_id = CASE WHEN _header ? 'grant_application_id' THEN NULLIF(_header->>'grant_application_id', '')::uuid ELSE invoice.grant_application_id END,
        invoice_date = COALESCE(NULLIF(_header->>'invoice_date', '')::date, invoice.invoice_date),
        due_date = CASE WHEN _header ? 'due_date' THEN NULLIF(_header->>'due_date', '')::date ELSE invoice.due_date END,
        memo = CASE WHEN _header ? 'memo' THEN NULLIF(trim(_header->>'memo'), '') ELSE invoice.memo END,
        document_id = CASE WHEN _header ? 'document_id' THEN NULLIF(_header->>'document_id', '')::uuid ELSE invoice.document_id END,
        updated_at = now()
    WHERE id = invoice.id RETURNING * INTO invoice;
  END IF;

  DELETE FROM public.finance_invoice_lines WHERE invoice_id = invoice.id;
  FOR line IN SELECT value FROM jsonb_array_elements(COALESCE(_lines, '[]'::jsonb)) LOOP
    line_number := line_number + 1;
    revenue_account_id := public.ensure_finance_ngo_account(
      invoice.ngo_id,
      NULLIF(line->>'account_id', '')::uuid,
      jsonb_build_object(
        'code', line->>'account_code', 'name', line->>'account_name',
        'account_type', COALESCE(line->>'account_type', 'revenue'),
        'account_subtype', line->>'account_subtype',
        'normal_balance', COALESCE(line->>'normal_balance', 'credit'),
        'entity_scope', 'fiscal_sponsorship',
        'revenue_restriction_class', line->>'revenue_restriction_class',
        'financial_statement_line', 'revenue'
      ),
      'invoice', invoice.id
    );
    IF NOT EXISTS (
      SELECT 1 FROM public.finance_accounts
      WHERE id = revenue_account_id AND account_type = 'revenue' AND is_active
    ) THEN RAISE EXCEPTION 'Invoice line account must be an active revenue account'; END IF;

    INSERT INTO public.finance_invoice_lines (
      invoice_id, account_id, description, amount, fund_id, ngo_id, line_number
    ) VALUES (
      invoice.id, revenue_account_id,
      COALESCE(NULLIF(trim(line->>'description'), ''), invoice.customer_name, invoice.invoice_number),
      round(COALESCE((line->>'amount')::numeric, 0), 2),
      NULLIF(line->>'fund_id', '')::uuid, invoice.ngo_id,
      COALESCE(NULLIF(line->>'line_number', '')::integer, line_number)
    );
  END LOOP;

  SELECT round(COALESCE(sum(amount), 0), 2) INTO invoice_total
  FROM public.finance_invoice_lines WHERE invoice_id = invoice.id;
  UPDATE public.finance_invoices
  SET subtotal = invoice_total, total = invoice_total, updated_at = now()
  WHERE id = invoice.id RETURNING * INTO invoice;

  PERFORM public.finance_log_audit_event(
    'finance_invoice', invoice.id,
    CASE WHEN _invoice_id IS NULL THEN 'created' ELSE 'updated' END,
    jsonb_build_object('ngo_id', invoice.ngo_id, 'total', invoice.total, 'line_count', line_number)
  );
  RETURN invoice;
END;
$$;

CREATE OR REPLACE FUNCTION public.issue_finance_invoice(_invoice_id uuid)
RETURNS public.finance_invoices
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  invoice public.finance_invoices;
  entry public.finance_journal_entries;
  resolved_receivable_account_id uuid;
  line_count integer;
  invoice_total numeric(18,2);
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_finance_ledger_manager() THEN RAISE EXCEPTION 'Finance manager access required'; END IF;
  SELECT * INTO invoice FROM public.finance_invoices WHERE id = _invoice_id FOR UPDATE;
  IF invoice.id IS NULL THEN RAISE EXCEPTION 'Invoice not found'; END IF;
  IF invoice.status NOT IN ('draft', 'sent') OR invoice.journal_entry_id IS NOT NULL THEN
    RAISE EXCEPTION 'Only an unposted draft invoice can be issued';
  END IF;
  SELECT count(*), round(COALESCE(sum(amount), 0), 2)
  INTO line_count, invoice_total FROM public.finance_invoice_lines WHERE invoice_id = invoice.id;
  IF line_count = 0 OR invoice_total <= 0 THEN RAISE EXCEPTION 'Invoice must contain positive revenue lines'; END IF;
  IF invoice.ngo_id IS NULL THEN RAISE EXCEPTION 'Invoice must belong to an NGO'; END IF;

  resolved_receivable_account_id := public.finance_resolve_accounts_receivable_account_id();
  IF resolved_receivable_account_id IS NULL THEN RAISE EXCEPTION 'Accounts Receivable control account not found'; END IF;
  PERFORM public.ensure_finance_ngo_account(invoice.ngo_id, resolved_receivable_account_id, '{}'::jsonb, 'invoice', invoice.id);

  INSERT INTO public.finance_journal_entries (
    entry_date, memo, source_type, source_id, status, created_by_user_id, ngo_id
  ) VALUES (
    invoice.invoice_date, COALESCE(invoice.memo, 'Invoice ' || invoice.invoice_number),
    'finance_invoice', invoice.id, 'draft', auth.uid(), invoice.ngo_id
  ) RETURNING * INTO entry;

  INSERT INTO public.finance_journal_lines (
    journal_entry_id, account_id, debit, credit, memo, ngo_id, document_id, line_number
  ) VALUES (
    entry.id, resolved_receivable_account_id, invoice_total, 0,
    'Accounts Receivable — ' || invoice.invoice_number,
    invoice.ngo_id, invoice.document_id, 1
  );

  INSERT INTO public.finance_journal_lines (
    journal_entry_id, account_id, debit, credit, memo, fund_id,
    ngo_id, grant_application_id, document_id, line_number
  )
  SELECT entry.id, line.account_id, 0, line.amount, line.description,
    line.fund_id, invoice.ngo_id, invoice.grant_application_id,
    invoice.document_id, line.line_number + 1
  FROM public.finance_invoice_lines line
  WHERE line.invoice_id = invoice.id ORDER BY line.line_number;

  entry := public.post_finance_journal_entry(entry.id);
  PERFORM set_config('hpg.finance_ar_rpc', 'on', true);
  UPDATE public.finance_invoices
  SET status = 'sent', subtotal = invoice_total, total = invoice_total,
      receivable_account_id = resolved_receivable_account_id,
      journal_entry_id = entry.id, issued_at = now(), updated_at = now()
  WHERE id = invoice.id RETURNING * INTO invoice;

  IF invoice.document_id IS NOT NULL THEN
    INSERT INTO public.finance_document_links (
      document_id, entity_type, entity_id, link_notes, created_by_user_id
    ) VALUES
      (invoice.document_id, 'journal_entry', entry.id, 'Invoice supporting document', auth.uid())
    ON CONFLICT DO NOTHING;
  END IF;

  PERFORM public.finance_log_audit_event(
    'finance_invoice', invoice.id, 'issued',
    jsonb_build_object('ngo_id', invoice.ngo_id, 'total', invoice.total, 'journal_entry_id', entry.id)
  );
  RETURN invoice;
END;
$$;

DROP FUNCTION IF EXISTS public.record_finance_invoice_payment(uuid, date, numeric, text, text);
CREATE FUNCTION public.record_finance_invoice_payment(
  _invoice_id uuid,
  _payment_date date,
  _amount numeric,
  _bank_account_id uuid,
  _payment_method text DEFAULT NULL,
  _memo text DEFAULT NULL,
  _document_id uuid DEFAULT NULL
)
RETURNS public.finance_invoice_payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  invoice public.finance_invoices;
  payment public.finance_invoice_payments;
  bank public.finance_bank_accounts;
  entry public.finance_journal_entries;
  remaining numeric(18,2);
  payment_amount numeric(18,2) := round(COALESCE(_amount, 0), 2);
  payment_memo text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_finance_ledger_manager() THEN RAISE EXCEPTION 'Finance manager access required'; END IF;
  SELECT * INTO invoice FROM public.finance_invoices WHERE id = _invoice_id FOR UPDATE;
  IF invoice.id IS NULL THEN RAISE EXCEPTION 'Invoice not found'; END IF;
  IF invoice.journal_entry_id IS NULL OR invoice.status NOT IN ('sent', 'partial') THEN
    RAISE EXCEPTION 'Invoice must be issued before recording payment';
  END IF;
  remaining := round(invoice.total - invoice.amount_paid - invoice.amount_written_off, 2);
  IF payment_amount <= 0 OR payment_amount > remaining THEN RAISE EXCEPTION 'Payment amount invalid; remaining balance is %', remaining; END IF;
  SELECT * INTO bank FROM public.finance_bank_accounts
  WHERE id = _bank_account_id AND ngo_id = invoice.ngo_id AND is_active;
  IF bank.id IS NULL THEN RAISE EXCEPTION 'Active bank account must belong to the invoice NGO'; END IF;
  payment_memo := COALESCE(NULLIF(trim(_memo), ''), 'Receipt for invoice ' || invoice.invoice_number);

  INSERT INTO public.finance_invoice_payments (
    invoice_id, ngo_id, payment_date, amount, payment_method,
    bank_account_id, memo, document_id, created_by_user_id
  ) VALUES (
    invoice.id, invoice.ngo_id, _payment_date, payment_amount,
    NULLIF(trim(_payment_method), ''), bank.id, payment_memo,
    _document_id, auth.uid()
  ) RETURNING * INTO payment;

  INSERT INTO public.finance_journal_entries (
    entry_date, memo, source_type, source_id, status, created_by_user_id, ngo_id
  ) VALUES (
    _payment_date, payment_memo, 'finance_invoice_payment', payment.id,
    'draft', auth.uid(), invoice.ngo_id
  ) RETURNING * INTO entry;
  INSERT INTO public.finance_journal_lines (
    journal_entry_id, account_id, debit, credit, memo, ngo_id, document_id, line_number
  ) VALUES
    (entry.id, bank.linked_finance_account_id, payment_amount, 0, payment_memo, invoice.ngo_id, _document_id, 1),
    (entry.id, invoice.receivable_account_id, 0, payment_amount, payment_memo, invoice.ngo_id, _document_id, 2);
  entry := public.post_finance_journal_entry(entry.id);

  UPDATE public.finance_invoice_payments SET journal_entry_id = entry.id WHERE id = payment.id RETURNING * INTO payment;
  PERFORM set_config('hpg.finance_ar_rpc', 'on', true);
  UPDATE public.finance_invoices
  SET amount_paid = round(amount_paid + payment_amount, 2),
      status = CASE WHEN round(amount_paid + amount_written_off + payment_amount, 2) >= total
        THEN 'paid'::public.finance_invoice_status ELSE 'partial'::public.finance_invoice_status END,
      updated_at = now()
  WHERE id = invoice.id;

  IF _document_id IS NOT NULL THEN
    INSERT INTO public.finance_document_links (
      document_id, entity_type, entity_id, link_notes, created_by_user_id
    ) VALUES
      (_document_id, 'journal_entry', entry.id, 'Invoice payment evidence', auth.uid())
    ON CONFLICT DO NOTHING;
  END IF;
  PERFORM public.finance_log_audit_event(
    'finance_invoice', invoice.id, 'payment_posted',
    jsonb_build_object('payment_id', payment.id, 'amount', payment_amount,
      'journal_entry_id', entry.id, 'ngo_id', invoice.ngo_id)
  );
  RETURN payment;
END;
$$;

CREATE OR REPLACE FUNCTION public.write_off_finance_invoice(
  _invoice_id uuid,
  _amount numeric,
  _reason text
)
RETURNS public.finance_invoices
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  invoice public.finance_invoices;
  entry public.finance_journal_entries;
  adjustment public.finance_invoice_adjustments;
  bad_debt_account_id uuid;
  remaining numeric(18,2);
  writeoff_amount numeric(18,2) := round(COALESCE(_amount, 0), 2);
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_finance_ledger_manager() THEN RAISE EXCEPTION 'Finance manager access required'; END IF;
  IF NULLIF(trim(_reason), '') IS NULL THEN RAISE EXCEPTION 'Write-off reason is required'; END IF;
  SELECT * INTO invoice FROM public.finance_invoices WHERE id = _invoice_id FOR UPDATE;
  IF invoice.id IS NULL THEN RAISE EXCEPTION 'Invoice not found'; END IF;
  IF invoice.journal_entry_id IS NULL OR invoice.status NOT IN ('sent', 'partial') THEN RAISE EXCEPTION 'Only an issued open invoice can be written off'; END IF;
  remaining := round(invoice.total - invoice.amount_paid - invoice.amount_written_off, 2);
  IF writeoff_amount <= 0 OR writeoff_amount > remaining THEN RAISE EXCEPTION 'Write-off amount invalid; remaining balance is %', remaining; END IF;
  bad_debt_account_id := public.finance_resolve_bad_debt_account_id();
  IF bad_debt_account_id IS NULL THEN RAISE EXCEPTION 'Bad debt expense account not found'; END IF;
  PERFORM public.ensure_finance_ngo_account(invoice.ngo_id, bad_debt_account_id, '{}'::jsonb, 'invoice_write_off', invoice.id);

  INSERT INTO public.finance_journal_entries (
    entry_date, memo, source_type, source_id, status, created_by_user_id, ngo_id
  ) VALUES (
    CURRENT_DATE, 'Write-off ' || invoice.invoice_number || ': ' || trim(_reason),
    'finance_invoice_write_off', invoice.id, 'draft', auth.uid(), invoice.ngo_id
  ) RETURNING * INTO entry;
  INSERT INTO public.finance_journal_lines (
    journal_entry_id, account_id, debit, credit, memo, ngo_id, line_number
  ) VALUES
    (entry.id, bad_debt_account_id, writeoff_amount, 0, trim(_reason), invoice.ngo_id, 1),
    (entry.id, invoice.receivable_account_id, 0, writeoff_amount, trim(_reason), invoice.ngo_id, 2);
  entry := public.post_finance_journal_entry(entry.id);

  INSERT INTO public.finance_invoice_adjustments (
    invoice_id, ngo_id, adjustment_date, adjustment_type, amount,
    reason, journal_entry_id, created_by_user_id
  ) VALUES (
    invoice.id, invoice.ngo_id, CURRENT_DATE, 'write_off', writeoff_amount,
    trim(_reason), entry.id, auth.uid()
  ) RETURNING * INTO adjustment;
  PERFORM set_config('hpg.finance_ar_rpc', 'on', true);
  UPDATE public.finance_invoices
  SET amount_written_off = round(amount_written_off + writeoff_amount, 2),
      status = CASE WHEN round(amount_paid + amount_written_off + writeoff_amount, 2) >= total
        THEN 'written_off'::public.finance_invoice_status ELSE status END,
      updated_at = now()
  WHERE id = invoice.id RETURNING * INTO invoice;
  PERFORM public.finance_log_audit_event(
    'finance_invoice', invoice.id, 'written_off',
    jsonb_build_object('adjustment_id', adjustment.id, 'amount', writeoff_amount,
      'reason', trim(_reason), 'journal_entry_id', entry.id)
  );
  RETURN invoice;
END;
$$;

CREATE OR REPLACE FUNCTION public.void_finance_invoice(_invoice_id uuid, _reason text)
RETURNS public.finance_invoices
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE invoice public.finance_invoices; reversal public.finance_journal_entries;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_finance_ledger_manager() THEN RAISE EXCEPTION 'Finance manager access required'; END IF;
  IF NULLIF(trim(_reason), '') IS NULL THEN RAISE EXCEPTION 'Void reason is required'; END IF;
  SELECT * INTO invoice FROM public.finance_invoices WHERE id = _invoice_id FOR UPDATE;
  IF invoice.id IS NULL THEN RAISE EXCEPTION 'Invoice not found'; END IF;
  IF invoice.status = 'draft' THEN
    DELETE FROM public.finance_invoices WHERE id = invoice.id;
    RETURN invoice;
  END IF;
  IF invoice.status = 'voided' THEN RAISE EXCEPTION 'Invoice is already voided'; END IF;
  IF EXISTS (SELECT 1 FROM public.finance_invoice_payments WHERE invoice_id = invoice.id)
    OR EXISTS (SELECT 1 FROM public.finance_invoice_adjustments WHERE invoice_id = invoice.id) THEN
    RAISE EXCEPTION 'Reverse invoice payments or adjustments before voiding the invoice';
  END IF;
  reversal := public.reverse_finance_journal_entry(
    invoice.journal_entry_id, CURRENT_DATE, 'Void invoice ' || invoice.invoice_number || ': ' || trim(_reason)
  );
  PERFORM set_config('hpg.finance_ar_rpc', 'on', true);
  UPDATE public.finance_invoices
  SET status = 'voided', voided_at = now(), void_reason = trim(_reason), updated_at = now()
  WHERE id = invoice.id RETURNING * INTO invoice;
  PERFORM public.finance_log_audit_event(
    'finance_invoice', invoice.id, 'voided',
    jsonb_build_object('reason', trim(_reason), 'reversal_entry_id', reversal.id)
  );
  RETURN invoice;
END;
$$;

REVOKE ALL ON FUNCTION public.save_finance_invoice(uuid, jsonb, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.issue_finance_invoice(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_finance_invoice_payment(uuid, date, numeric, uuid, text, text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.write_off_finance_invoice(uuid, numeric, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.void_finance_invoice(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_finance_invoice(uuid, jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.issue_finance_invoice(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_finance_invoice_payment(uuid, date, numeric, uuid, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.write_off_finance_invoice(uuid, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.void_finance_invoice(uuid, text) TO authenticated;

-- All AR mutations go through the authority-checked, atomic functions above.
REVOKE INSERT, UPDATE, DELETE ON public.finance_invoices FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.finance_invoice_lines FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.finance_invoice_payments FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.finance_invoice_adjustments FROM authenticated;
GRANT SELECT ON public.finance_invoices, public.finance_invoice_lines,
  public.finance_invoice_payments, public.finance_invoice_adjustments TO authenticated;
