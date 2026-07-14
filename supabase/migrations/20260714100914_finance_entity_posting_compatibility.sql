-- Entity compatibility for every journal-producing finance workflow.

ALTER TABLE public.finance_bills
  ADD COLUMN IF NOT EXISTS ngo_id uuid REFERENCES public.ngos(id) ON DELETE RESTRICT;
ALTER TABLE public.finance_deposits
  ADD COLUMN IF NOT EXISTS ngo_id uuid REFERENCES public.ngos(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_finance_bills_ngo
  ON public.finance_bills(ngo_id, bill_date DESC);
CREATE INDEX IF NOT EXISTS idx_finance_deposits_ngo
  ON public.finance_deposits(ngo_id, deposit_date DESC);

WITH bill_scope AS (
  SELECT bill_id, min(ngo_id::text)::uuid AS ngo_id, count(DISTINCT ngo_id) AS ngo_count
  FROM public.finance_bill_lines WHERE ngo_id IS NOT NULL GROUP BY bill_id
)
UPDATE public.finance_bills bill
SET ngo_id = scope.ngo_id
FROM bill_scope scope
WHERE bill.id = scope.bill_id AND scope.ngo_count = 1 AND bill.ngo_id IS NULL;

WITH deposit_scope AS (
  SELECT deposit_id, min(ngo_id::text)::uuid AS ngo_id, count(DISTINCT ngo_id) AS ngo_count
  FROM public.finance_deposit_lines WHERE ngo_id IS NOT NULL GROUP BY deposit_id
)
UPDATE public.finance_deposits deposit
SET ngo_id = scope.ngo_id
FROM deposit_scope scope
WHERE deposit.id = scope.deposit_id AND scope.ngo_count = 1 AND deposit.ngo_id IS NULL;

CREATE OR REPLACE FUNCTION public.finance_validate_bill_line_entity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE header_ngo_id uuid;
BEGIN
  SELECT ngo_id INTO header_ngo_id FROM public.finance_bills WHERE id = NEW.bill_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Bill not found'; END IF;
  IF NEW.ngo_id IS DISTINCT FROM header_ngo_id THEN
    RAISE EXCEPTION 'Every bill line must belong to the bill NGO';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_finance_validate_bill_line_entity ON public.finance_bill_lines;
CREATE TRIGGER trg_finance_validate_bill_line_entity
  BEFORE INSERT OR UPDATE ON public.finance_bill_lines
  FOR EACH ROW EXECUTE FUNCTION public.finance_validate_bill_line_entity();

CREATE OR REPLACE FUNCTION public.finance_validate_deposit_line_entity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE header_ngo_id uuid;
BEGIN
  SELECT ngo_id INTO header_ngo_id FROM public.finance_deposits WHERE id = NEW.deposit_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Deposit not found'; END IF;
  IF NEW.ngo_id IS DISTINCT FROM header_ngo_id THEN
    RAISE EXCEPTION 'Every deposit line must belong to the deposit NGO';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_finance_validate_deposit_line_entity ON public.finance_deposit_lines;
CREATE TRIGGER trg_finance_validate_deposit_line_entity
  BEFORE INSERT OR UPDATE ON public.finance_deposit_lines
  FOR EACH ROW EXECUTE FUNCTION public.finance_validate_deposit_line_entity();

CREATE OR REPLACE FUNCTION public.approve_finance_bill(_bill_id uuid)
RETURNS public.finance_bills
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  bill public.finance_bills;
  ap_account_id uuid;
  entry public.finance_journal_entries;
  line_count integer;
  total numeric(18, 2);
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_finance_ledger_manager() THEN
    RAISE EXCEPTION 'Finance manager access required to approve bills';
  END IF;

  SELECT * INTO bill FROM public.finance_bills WHERE id = _bill_id FOR UPDATE;
  IF bill.id IS NULL THEN RAISE EXCEPTION 'Bill not found'; END IF;
  IF bill.status NOT IN ('draft', 'pending_approval') THEN
    RAISE EXCEPTION 'Only draft or pending approval bills can be approved. Current status: %', bill.status;
  END IF;

  SELECT count(*), COALESCE(sum(amount), 0)
  INTO line_count, total
  FROM public.finance_bill_lines
  WHERE bill_id = _bill_id;

  IF line_count = 0 OR total <= 0 THEN
    RAISE EXCEPTION 'Bill must have at least one positive line';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.finance_bill_lines
    WHERE bill_id = _bill_id AND ngo_id IS DISTINCT FROM bill.ngo_id
  ) THEN
    RAISE EXCEPTION 'Bill contains a line for another NGO';
  END IF;

  ap_account_id := public.finance_resolve_accounts_payable_account_id();
  IF ap_account_id IS NULL THEN RAISE EXCEPTION 'No Accounts Payable GL account found'; END IF;

  INSERT INTO public.finance_journal_entries (
    entry_date, memo, source_type, source_id, status, created_by_user_id, ngo_id
  ) VALUES (
    bill.bill_date, COALESCE(bill.memo, 'Bill ' || bill.bill_number),
    'finance_bill', bill.id, 'draft', auth.uid(), bill.ngo_id
  ) RETURNING * INTO entry;

  INSERT INTO public.finance_journal_lines (
    journal_entry_id, account_id, debit, credit, memo, fund_id, ngo_id,
    department_id, dimension_id, grant_application_id, document_id, line_number
  )
  SELECT
    entry.id, line.expense_account_id, line.amount, 0, line.memo,
    line.fund_id, bill.ngo_id, line.department_id, line.dimension_id,
    line.grant_application_id, bill.document_id, line.line_number
  FROM public.finance_bill_lines line
  WHERE line.bill_id = _bill_id
  ORDER BY line.line_number;

  INSERT INTO public.finance_journal_lines (
    journal_entry_id, account_id, debit, credit, memo, ngo_id, line_number
  ) VALUES (
    entry.id, ap_account_id, 0, total,
    'Accounts Payable — ' || bill.bill_number, bill.ngo_id, line_count + 1
  );

  entry := public.post_finance_journal_entry(entry.id);

  UPDATE public.finance_bills
  SET status = 'approved', journal_entry_id = entry.id,
      approved_by_user_id = auth.uid(), approved_at = now(),
      total_amount = total, updated_at = now()
  WHERE id = _bill_id
  RETURNING * INTO bill;

  IF bill.document_id IS NOT NULL THEN
    INSERT INTO public.finance_document_links (
      document_id, entity_type, entity_id, link_notes, created_by_user_id
    ) VALUES
      (bill.document_id, 'bill', bill.id, 'Bill supporting document', auth.uid()),
      (bill.document_id, 'journal_entry', entry.id, 'Bill supporting document', auth.uid())
    ON CONFLICT DO NOTHING;
  END IF;

  PERFORM public.finance_log_audit_event(
    'finance_bill', bill.id, 'approved',
    jsonb_build_object('bill_number', bill.bill_number, 'total_amount', total,
      'journal_entry_id', entry.id, 'ngo_id', bill.ngo_id)
  );
  RETURN bill;
END;
$$;

CREATE OR REPLACE FUNCTION public.pay_finance_bill(
  _bill_id uuid,
  _amount numeric,
  _bank_account_id uuid,
  _payment_date date DEFAULT CURRENT_DATE,
  _memo text DEFAULT NULL
)
RETURNS public.finance_bill_payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  bill public.finance_bills;
  ap_account_id uuid;
  bank public.finance_bank_accounts;
  entry public.finance_journal_entries;
  payment public.finance_bill_payments;
  balance_due numeric(18, 2);
  payment_amount numeric(18, 2) := round(COALESCE(_amount, 0), 2);
  payment_memo text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_finance_ledger_manager() THEN
    RAISE EXCEPTION 'Finance manager access required to pay bills';
  END IF;
  IF payment_amount <= 0 THEN RAISE EXCEPTION 'Payment amount must be greater than zero'; END IF;

  SELECT * INTO bill FROM public.finance_bills WHERE id = _bill_id FOR UPDATE;
  IF bill.id IS NULL THEN RAISE EXCEPTION 'Bill not found'; END IF;
  IF bill.status NOT IN ('approved', 'partially_paid') THEN
    RAISE EXCEPTION 'Only approved or partially paid bills can be paid';
  END IF;

  balance_due := round(bill.total_amount - bill.amount_paid, 2);
  IF payment_amount > balance_due THEN RAISE EXCEPTION 'Payment exceeds balance due'; END IF;

  SELECT * INTO bank FROM public.finance_bank_accounts WHERE id = _bank_account_id AND is_active = true;
  IF bank.id IS NULL THEN RAISE EXCEPTION 'Active bank account not found'; END IF;
  ap_account_id := public.finance_resolve_accounts_payable_account_id();
  IF ap_account_id IS NULL THEN RAISE EXCEPTION 'No Accounts Payable GL account found'; END IF;
  payment_memo := COALESCE(NULLIF(trim(_memo), ''), 'Payment for bill ' || bill.bill_number);

  INSERT INTO public.finance_journal_entries (
    entry_date, memo, source_type, source_id, status, created_by_user_id, ngo_id
  ) VALUES (
    _payment_date, payment_memo, 'finance_bill_payment', bill.id,
    'draft', auth.uid(), bill.ngo_id
  ) RETURNING * INTO entry;

  INSERT INTO public.finance_journal_lines (
    journal_entry_id, account_id, debit, credit, memo, ngo_id, line_number
  ) VALUES
    (entry.id, ap_account_id, payment_amount, 0, payment_memo, bill.ngo_id, 1),
    (entry.id, bank.linked_finance_account_id, 0, payment_amount, payment_memo, bill.ngo_id, 2);

  entry := public.post_finance_journal_entry(entry.id);

  INSERT INTO public.finance_bill_payments (
    bill_id, payment_date, amount, bank_account_id, journal_entry_id,
    memo, created_by_user_id
  ) VALUES (
    bill.id, _payment_date, payment_amount, bank.id, entry.id,
    payment_memo, auth.uid()
  ) RETURNING * INTO payment;

  UPDATE public.finance_bills
  SET amount_paid = round(amount_paid + payment_amount, 2),
      status = CASE WHEN round(amount_paid + payment_amount, 2) >= total_amount
        THEN 'paid'::public.finance_bill_status ELSE 'partially_paid'::public.finance_bill_status END,
      updated_at = now()
  WHERE id = bill.id;

  PERFORM public.finance_log_audit_event(
    'finance_bill', bill.id, 'payment_posted',
    jsonb_build_object('amount', payment_amount, 'journal_entry_id', entry.id, 'ngo_id', bill.ngo_id)
  );
  RETURN payment;
END;
$$;

CREATE OR REPLACE FUNCTION public.post_finance_deposit(_deposit_id uuid)
RETURNS public.finance_deposits
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deposit public.finance_deposits;
  bank public.finance_bank_accounts;
  entry public.finance_journal_entries;
  total numeric(18, 2);
  line_count integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_finance_ledger_manager() THEN
    RAISE EXCEPTION 'Finance manager access required';
  END IF;
  SELECT * INTO deposit FROM public.finance_deposits WHERE id = _deposit_id FOR UPDATE;
  IF deposit.id IS NULL THEN RAISE EXCEPTION 'Deposit not found'; END IF;
  IF deposit.status NOT IN ('draft', 'pending_approval') THEN RAISE EXCEPTION 'Deposit not postable'; END IF;

  SELECT count(*), COALESCE(sum(amount), 0) INTO line_count, total
  FROM public.finance_deposit_lines WHERE deposit_id = _deposit_id;
  IF line_count = 0 OR total <= 0 THEN RAISE EXCEPTION 'Deposit must have lines'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.finance_deposit_lines
    WHERE deposit_id = _deposit_id AND ngo_id IS DISTINCT FROM deposit.ngo_id
  ) THEN RAISE EXCEPTION 'Deposit contains a line for another NGO'; END IF;

  SELECT * INTO bank FROM public.finance_bank_accounts WHERE id = deposit.bank_account_id AND is_active = true;
  IF bank.id IS NULL THEN RAISE EXCEPTION 'Active bank account not found'; END IF;

  INSERT INTO public.finance_journal_entries (
    entry_date, memo, source_type, source_id, status, created_by_user_id, ngo_id
  ) VALUES (
    deposit.deposit_date, COALESCE(deposit.memo, deposit.deposit_number),
    'finance_deposit', deposit.id, 'draft', auth.uid(), deposit.ngo_id
  ) RETURNING * INTO entry;

  INSERT INTO public.finance_journal_lines (
    journal_entry_id, account_id, debit, credit, memo, ngo_id, document_id, line_number
  ) VALUES (
    entry.id, bank.linked_finance_account_id, total, 0,
    deposit.memo, deposit.ngo_id, deposit.document_id, 1
  );

  INSERT INTO public.finance_journal_lines (
    journal_entry_id, account_id, debit, credit, memo, fund_id,
    ngo_id, grant_application_id, line_number
  )
  SELECT entry.id, line.revenue_account_id, 0, line.amount, line.memo,
    line.fund_id, deposit.ngo_id, line.grant_application_id, line.line_number + 1
  FROM public.finance_deposit_lines line
  WHERE line.deposit_id = _deposit_id
  ORDER BY line.line_number;

  entry := public.post_finance_journal_entry(entry.id);

  UPDATE public.finance_deposits
  SET status = 'posted', journal_entry_id = entry.id, total_amount = total,
      approved_by_user_id = auth.uid(), posted_at = now(), updated_at = now()
  WHERE id = _deposit_id
  RETURNING * INTO deposit;

  IF deposit.document_id IS NOT NULL THEN
    INSERT INTO public.finance_document_links (
      document_id, entity_type, entity_id, link_notes, created_by_user_id
    ) VALUES
      (deposit.document_id, 'deposit', deposit.id, 'Deposit supporting document', auth.uid()),
      (deposit.document_id, 'journal_entry', entry.id, 'Deposit supporting document', auth.uid())
    ON CONFLICT DO NOTHING;
  END IF;

  PERFORM public.finance_log_audit_event(
    'finance_deposit', deposit.id, 'posted',
    jsonb_build_object('deposit_number', deposit.deposit_number, 'total', total,
      'journal_entry_id', entry.id, 'ngo_id', deposit.ngo_id)
  );
  RETURN deposit;
END;
$$;

CREATE OR REPLACE FUNCTION public.post_finance_payment(_payment_id uuid)
RETURNS public.finance_payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  payment public.finance_payments;
  entry public.finance_journal_entries;
  bank public.finance_bank_accounts;
  target_bank public.finance_bank_accounts;
  bill_payment public.finance_bill_payments;
  paid_from_account_id uuid;
  expense_account_id uuid;
  memo text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_finance_ledger_manager() THEN
    RAISE EXCEPTION 'Finance manager access required';
  END IF;
  SELECT * INTO payment FROM public.finance_payments WHERE id = _payment_id FOR UPDATE;
  IF payment.id IS NULL THEN RAISE EXCEPTION 'Payment not found'; END IF;
  IF payment.status NOT IN ('draft', 'pending_approval') THEN
    RAISE EXCEPTION 'Only draft or pending approval payments can be posted';
  END IF;
  memo := COALESCE(payment.memo, payment.payment_number);

  IF payment.payment_type = 'vendor_bill' THEN
    IF payment.bill_id IS NULL OR payment.bank_account_id IS NULL THEN
      RAISE EXCEPTION 'Vendor bill payment requires bill and bank account';
    END IF;
    bill_payment := public.pay_finance_bill(
      payment.bill_id, payment.amount, payment.bank_account_id, payment.payment_date, memo
    );
    SELECT * INTO entry FROM public.finance_journal_entries WHERE id = bill_payment.journal_entry_id;
    SELECT ngo_id INTO payment.ngo_id FROM public.finance_bills WHERE id = payment.bill_id;
  ELSE
    IF payment.bank_account_id IS NOT NULL THEN
      SELECT * INTO bank FROM public.finance_bank_accounts
      WHERE id = payment.bank_account_id AND is_active = true;
      IF bank.id IS NULL THEN RAISE EXCEPTION 'Active bank account not found'; END IF;
      paid_from_account_id := bank.linked_finance_account_id;
    ELSE
      paid_from_account_id := payment.payment_account_id;
    END IF;
    IF paid_from_account_id IS NULL THEN RAISE EXCEPTION 'Paid-from account is required'; END IF;

    INSERT INTO public.finance_journal_entries (
      entry_date, memo, source_type, source_id, status, created_by_user_id, ngo_id
    ) VALUES (
      payment.payment_date, memo, 'finance_payment', payment.id,
      'draft', auth.uid(), payment.ngo_id
    ) RETURNING * INTO entry;

    IF payment.payment_type = 'reimbursement' THEN
      IF payment.expense_account_id IS NULL THEN RAISE EXCEPTION 'Expense account is required'; END IF;
      expense_account_id := payment.expense_account_id;
    ELSIF payment.payment_type IN ('ngo_disbursement', 'grant_pass_through') THEN
      IF payment.ngo_id IS NULL THEN RAISE EXCEPTION 'Disbursement requires an NGO'; END IF;
      SELECT id INTO expense_account_id FROM public.finance_accounts
      WHERE is_active AND account_type = 'expense'
        AND (account_subtype = 'grant_disbursement' OR code = '5100')
      ORDER BY CASE WHEN account_subtype = 'grant_disbursement' THEN 0 ELSE 1 END
      LIMIT 1;
      IF expense_account_id IS NULL THEN RAISE EXCEPTION 'Grant disbursement expense account not found'; END IF;
    ELSIF payment.payment_type = 'internal_transfer' THEN
      IF payment.bank_account_id IS NULL OR payment.target_bank_account_id IS NULL THEN
        RAISE EXCEPTION 'Internal transfer requires source and target bank accounts';
      END IF;
      SELECT * INTO target_bank FROM public.finance_bank_accounts
      WHERE id = payment.target_bank_account_id AND is_active = true;
      IF target_bank.id IS NULL THEN RAISE EXCEPTION 'Active target bank account not found'; END IF;

      INSERT INTO public.finance_journal_lines (
        journal_entry_id, account_id, debit, credit, memo, ngo_id, line_number
      ) VALUES
        (entry.id, target_bank.linked_finance_account_id, payment.amount, 0, memo, payment.ngo_id, 1),
        (entry.id, paid_from_account_id, 0, payment.amount, memo, payment.ngo_id, 2);
    END IF;

    IF payment.payment_type <> 'internal_transfer' THEN
      INSERT INTO public.finance_journal_lines (
        journal_entry_id, account_id, debit, credit, memo, fund_id, ngo_id,
        grant_application_id, document_id, line_number
      ) VALUES
        (entry.id, expense_account_id, payment.amount, 0, memo, payment.fund_id,
          payment.ngo_id, payment.grant_application_id, payment.document_id, 1),
        (entry.id, paid_from_account_id, 0, payment.amount, memo, payment.fund_id,
          payment.ngo_id, NULL, NULL, 2);
    END IF;

    entry := public.post_finance_journal_entry(entry.id);
  END IF;

  UPDATE public.finance_payments
  SET status = 'posted', journal_entry_id = entry.id, ngo_id = payment.ngo_id,
      payment_account_id = COALESCE(payment.payment_account_id, paid_from_account_id),
      approved_by_user_id = COALESCE(approved_by_user_id, auth.uid()),
      approved_at = COALESCE(approved_at, now()), updated_at = now()
  WHERE id = _payment_id
  RETURNING * INTO payment;

  IF payment.document_id IS NOT NULL THEN
    INSERT INTO public.finance_document_links (
      document_id, entity_type, entity_id, link_notes, created_by_user_id
    ) VALUES
      (payment.document_id, 'payment', payment.id, 'Payment supporting document', auth.uid()),
      (payment.document_id, 'journal_entry', entry.id, 'Payment supporting document', auth.uid())
    ON CONFLICT DO NOTHING;
  END IF;

  PERFORM public.finance_log_audit_event(
    'finance_payment', payment.id, 'posted',
    jsonb_build_object('payment_number', payment.payment_number, 'amount', payment.amount,
      'journal_entry_id', entry.id, 'ngo_id', payment.ngo_id)
  );
  RETURN payment;
END;
$$;

REVOKE ALL ON FUNCTION public.finance_validate_bill_line_entity() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finance_validate_deposit_line_entity() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.approve_finance_bill(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_finance_bill(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.pay_finance_bill(uuid, numeric, uuid, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pay_finance_bill(uuid, numeric, uuid, date, text) TO authenticated;
REVOKE ALL ON FUNCTION public.post_finance_deposit(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.post_finance_deposit(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.post_finance_payment(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.post_finance_payment(uuid) TO authenticated;
