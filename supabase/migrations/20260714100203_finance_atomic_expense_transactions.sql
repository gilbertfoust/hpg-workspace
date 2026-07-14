-- Atomic expense transactions
--
-- Adds the simple day-to-day transaction contract requested by Finance:
-- selected NGO + expense account + paid-from account + payment method + receipt
-- becomes one posted, balanced journal entry in a single database transaction.

ALTER TABLE public.finance_payments
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS payment_account_id uuid REFERENCES public.finance_accounts(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS reference_number text,
  ADD COLUMN IF NOT EXISTS reversal_journal_entry_id uuid REFERENCES public.finance_journal_entries(id) ON DELETE SET NULL;

ALTER TABLE public.finance_payments
  DROP CONSTRAINT IF EXISTS finance_payments_payment_method_check;
ALTER TABLE public.finance_payments
  ADD CONSTRAINT finance_payments_payment_method_check
  CHECK (
    payment_method IS NULL
    OR payment_method IN ('cash', 'check', 'ach', 'debit_card', 'credit_card', 'wire', 'other')
  );

CREATE INDEX IF NOT EXISTS idx_finance_payments_payment_account
  ON public.finance_payments(payment_account_id);
CREATE INDEX IF NOT EXISTS idx_finance_payments_journal_entry
  ON public.finance_payments(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_finance_payments_reversal_entry
  ON public.finance_payments(reversal_journal_entry_id);

-- A starter credit-card liability lets the workflow function before a custom
-- card register is configured. Finance can rename or replace it later.
INSERT INTO public.finance_accounts (
  code, name, account_type, account_subtype, normal_balance,
  is_active, is_cash_account, financial_statement_line, entity_scope
)
VALUES (
  '2200', 'Credit Card Payable', 'liability', 'credit_card', 'credit',
  true, false, 'liabilities', 'hpg_operating'
)
ON CONFLICT (code) DO NOTHING;

CREATE OR REPLACE FUNCTION public.finance_guard_posted_payment()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status <> 'draft' THEN
      RAISE EXCEPTION 'Only draft payments can be deleted.';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.status IN ('posted', 'voided') THEN
    IF OLD.status = 'posted' AND NEW.status = 'voided' THEN
      IF (
        to_jsonb(NEW) - ARRAY['status', 'voided_at', 'void_reason', 'reversal_journal_entry_id', 'updated_at']::text[]
      ) IS DISTINCT FROM (
        to_jsonb(OLD) - ARRAY['status', 'voided_at', 'void_reason', 'reversal_journal_entry_id', 'updated_at']::text[]
      ) THEN
        RAISE EXCEPTION 'Voiding cannot alter posted payment details.';
      END IF;
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Posted or voided payments cannot be edited directly.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_and_post_finance_expense_transaction(
  _ngo_id uuid,
  _expense_account_id uuid,
  _payment_account_id uuid,
  _payment_method text,
  _payment_date date,
  _amount numeric,
  _payee_name text,
  _memo text DEFAULT NULL,
  _reference_number text DEFAULT NULL,
  _document_id uuid DEFAULT NULL,
  _fund_id uuid DEFAULT NULL,
  _receipt_file_path text DEFAULT NULL,
  _receipt_file_name text DEFAULT NULL,
  _receipt_file_type text DEFAULT NULL,
  _receipt_file_size integer DEFAULT NULL
)
RETURNS public.finance_payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_amount numeric(18, 2) := round(COALESCE(_amount, 0), 2);
  normalized_method text := lower(trim(COALESCE(_payment_method, '')));
  normalized_payee text := NULLIF(trim(_payee_name), '');
  normalized_memo text;
  expense_account public.finance_accounts;
  payment_account public.finance_accounts;
  payment public.finance_payments;
  entry public.finance_journal_entries;
  resolved_document_id uuid := _document_id;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_finance_ledger_manager() THEN
    RAISE EXCEPTION 'Finance manager access required to post expense transactions';
  END IF;

  IF _ngo_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.ngos WHERE id = _ngo_id) THEN
    RAISE EXCEPTION 'Select a valid NGO before posting the transaction';
  END IF;
  IF COALESCE(_payment_date, CURRENT_DATE) > CURRENT_DATE + 1 THEN
    RAISE EXCEPTION 'Payment date cannot be in the future';
  END IF;
  IF normalized_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be greater than zero';
  END IF;
  IF normalized_payee IS NULL THEN
    RAISE EXCEPTION 'Payee is required';
  END IF;
  IF normalized_method NOT IN ('cash', 'check', 'ach', 'debit_card', 'credit_card', 'wire', 'other') THEN
    RAISE EXCEPTION 'Select a supported payment method';
  END IF;

  SELECT * INTO expense_account
  FROM public.finance_accounts
  WHERE id = _expense_account_id AND is_active = true;
  IF expense_account.id IS NULL OR expense_account.account_type <> 'expense' THEN
    RAISE EXCEPTION 'Select an active expense account';
  END IF;

  SELECT * INTO payment_account
  FROM public.finance_accounts
  WHERE id = _payment_account_id AND is_active = true;
  IF payment_account.id IS NULL OR payment_account.account_type NOT IN ('asset', 'liability') THEN
    RAISE EXCEPTION 'Paid-from account must be an active asset or liability account';
  END IF;
  IF normalized_method = 'credit_card' AND payment_account.account_type <> 'liability' THEN
    RAISE EXCEPTION 'Credit card transactions must credit a liability account';
  END IF;
  IF normalized_method IN ('cash', 'check', 'ach', 'debit_card', 'wire')
     AND payment_account.account_type <> 'asset' THEN
    RAISE EXCEPTION 'This payment method must use an asset or cash account';
  END IF;

  IF _fund_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.finance_funds
    WHERE id = _fund_id AND is_active = true
      AND (ngo_id IS NULL OR ngo_id = _ngo_id)
  ) THEN
    RAISE EXCEPTION 'Selected fund is inactive or belongs to another NGO';
  END IF;

  IF _document_id IS NOT NULL AND _receipt_file_path IS NOT NULL THEN
    RAISE EXCEPTION 'Provide either an existing document or a new receipt upload, not both';
  END IF;

  IF _document_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.documents
    WHERE id = _document_id AND ngo_id IS NOT DISTINCT FROM _ngo_id
  ) THEN
    RAISE EXCEPTION 'Receipt does not belong to the selected NGO';
  END IF;

  IF _receipt_file_path IS NOT NULL THEN
    IF _receipt_file_path NOT LIKE ('internal/finance/receipts/' || _ngo_id::text || '/%') THEN
      RAISE EXCEPTION 'Receipt storage path is outside the selected NGO finance folder';
    END IF;
    IF NULLIF(trim(_receipt_file_name), '') IS NULL THEN
      RAISE EXCEPTION 'Receipt file name is required';
    END IF;
    IF COALESCE(_receipt_file_size, 0) <= 0 OR _receipt_file_size > 15728640 THEN
      RAISE EXCEPTION 'Receipt must be between 1 byte and 15 MB';
    END IF;
    IF COALESCE(_receipt_file_type, '') <> 'application/pdf'
       AND COALESCE(_receipt_file_type, '') NOT LIKE 'image/%' THEN
      RAISE EXCEPTION 'Receipt must be a PDF or image';
    END IF;

    INSERT INTO public.documents (
      ngo_id, file_path, file_name, file_type, file_size,
      category, uploaded_by_user_id, review_status, title
    ) VALUES (
      _ngo_id, _receipt_file_path, trim(_receipt_file_name), _receipt_file_type,
      _receipt_file_size, 'finance', auth.uid(), 'pending', 'Receipt — ' || normalized_payee
    ) RETURNING id INTO resolved_document_id;
  END IF;

  normalized_memo := COALESCE(
    NULLIF(trim(_memo), ''),
    normalized_payee || ' — ' || expense_account.name
  );

  INSERT INTO public.finance_payments (
    payment_number, payment_type, payment_date, amount, status,
    payee_name, ngo_id, fund_id, expense_account_id, payment_account_id,
    payment_method, reference_number, memo, document_id,
    approved_by_user_id, approved_at, created_by_user_id
  ) VALUES (
    '', 'reimbursement', COALESCE(_payment_date, CURRENT_DATE), normalized_amount, 'draft',
    normalized_payee, _ngo_id, _fund_id, expense_account.id, payment_account.id,
    normalized_method, NULLIF(trim(_reference_number), ''), normalized_memo, resolved_document_id,
    auth.uid(), now(), auth.uid()
  ) RETURNING * INTO payment;

  INSERT INTO public.finance_journal_entries (
    entry_date, memo, source_type, source_id, status, created_by_user_id, ngo_id
  ) VALUES (
    payment.payment_date, normalized_memo, 'finance_expense_transaction', payment.id,
    'draft', auth.uid(), _ngo_id
  ) RETURNING * INTO entry;

  INSERT INTO public.finance_journal_lines (
    journal_entry_id, account_id, debit, credit, memo,
    fund_id, ngo_id, document_id, line_number
  ) VALUES
    (entry.id, expense_account.id, normalized_amount, 0, normalized_memo,
      _fund_id, _ngo_id, resolved_document_id, 1),
    (entry.id, payment_account.id, 0, normalized_amount,
      COALESCE(NULLIF(trim(_reference_number), ''), normalized_method),
      _fund_id, _ngo_id, NULL, 2);

  entry := public.post_finance_journal_entry(entry.id);

  UPDATE public.finance_payments
  SET status = 'posted',
      journal_entry_id = entry.id,
      updated_at = now()
  WHERE id = payment.id
  RETURNING * INTO payment;

  IF resolved_document_id IS NOT NULL THEN
    INSERT INTO public.finance_document_links (
      document_id, entity_type, entity_id, link_notes, created_by_user_id
    ) VALUES
      (resolved_document_id, 'payment', payment.id, 'Receipt attached when transaction posted', auth.uid()),
      (resolved_document_id, 'journal_entry', entry.id, 'Receipt attached when transaction posted', auth.uid())
    ON CONFLICT DO NOTHING;
  END IF;

  PERFORM public.finance_log_audit_event(
    'finance_payment', payment.id, 'expense_transaction_posted',
    jsonb_build_object(
      'payment_number', payment.payment_number,
      'journal_entry_id', entry.id,
      'ngo_id', _ngo_id,
      'amount', normalized_amount,
      'expense_account_id', expense_account.id,
      'payment_account_id', payment_account.id,
      'payment_method', normalized_method,
      'document_id', resolved_document_id
    )
  );

  RETURN payment;
END;
$$;

CREATE OR REPLACE FUNCTION public.void_finance_payment(
  _payment_id uuid,
  _reason text DEFAULT NULL
)
RETURNS public.finance_payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  payment public.finance_payments;
  reversal public.finance_journal_entries;
  normalized_reason text := COALESCE(NULLIF(trim(_reason), ''), 'Voided');
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_finance_ledger_manager() THEN
    RAISE EXCEPTION 'Finance manager access required';
  END IF;

  SELECT * INTO payment
  FROM public.finance_payments
  WHERE id = _payment_id
  FOR UPDATE;

  IF payment.id IS NULL THEN RAISE EXCEPTION 'Payment not found'; END IF;
  IF payment.status <> 'posted' THEN RAISE EXCEPTION 'Only posted payments can be voided'; END IF;
  IF payment.journal_entry_id IS NULL THEN RAISE EXCEPTION 'Posted payment has no journal entry to reverse'; END IF;

  reversal := public.reverse_finance_journal_entry(
    payment.journal_entry_id,
    CURRENT_DATE,
    'Void ' || payment.payment_number || ': ' || normalized_reason
  );

  UPDATE public.finance_payments
  SET status = 'voided',
      voided_at = now(),
      void_reason = normalized_reason,
      reversal_journal_entry_id = reversal.id,
      updated_at = now()
  WHERE id = _payment_id
  RETURNING * INTO payment;

  PERFORM public.finance_log_audit_event(
    'finance_payment', payment.id, 'voided',
    jsonb_build_object(
      'reason', normalized_reason,
      'journal_entry_id', payment.journal_entry_id,
      'reversal_journal_entry_id', reversal.id
    )
  );
  RETURN payment;
END;
$$;

REVOKE ALL ON FUNCTION public.create_and_post_finance_expense_transaction(
  uuid, uuid, uuid, text, date, numeric, text, text, text, uuid, uuid, text, text, text, integer
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_and_post_finance_expense_transaction(
  uuid, uuid, uuid, text, date, numeric, text, text, text, uuid, uuid, text, text, text, integer
) TO authenticated;

REVOKE ALL ON FUNCTION public.void_finance_payment(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.void_finance_payment(uuid, text) TO authenticated;
