-- Finance receipt intelligence
--
-- A receipt is registered once per NGO by SHA-256 fingerprint, extracted into a
-- reviewable draft, and only reaches the ledger through the existing atomic
-- expense posting contract.  AI/OCR output is deliberately a draft: Finance
-- confirms the accounts before the balanced journal entry is posted.

CREATE TABLE IF NOT EXISTS public.finance_receipt_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ngo_id uuid NOT NULL REFERENCES public.ngos(id) ON DELETE RESTRICT,
  document_id uuid NOT NULL UNIQUE REFERENCES public.documents(id) ON DELETE RESTRICT,
  content_sha256 text NOT NULL,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'processing', 'ready', 'needs_review', 'failed', 'posted')),
  merchant_name text,
  transaction_date date,
  subtotal numeric(18, 2),
  tax_amount numeric(18, 2),
  tip_amount numeric(18, 2),
  total_amount numeric(18, 2),
  currency text NOT NULL DEFAULT 'USD',
  payment_method text
    CHECK (
      payment_method IS NULL
      OR payment_method IN ('cash', 'check', 'ach', 'debit_card', 'credit_card', 'wire', 'other')
    ),
  reference_number text,
  memo text,
  suggested_expense_account_id uuid REFERENCES public.finance_accounts(id) ON DELETE SET NULL,
  suggested_payment_account_id uuid REFERENCES public.finance_accounts(id) ON DELETE SET NULL,
  confidence numeric(5, 4) CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  needs_review_reasons text[] NOT NULL DEFAULT '{}',
  extracted_data_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  extraction_attempted_at timestamptz,
  extraction_completed_at timestamptz,
  posted_payment_id uuid UNIQUE REFERENCES public.finance_payments(id) ON DELETE RESTRICT,
  created_by_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT finance_receipt_drafts_hash_format
    CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT finance_receipt_drafts_amounts_nonnegative
    CHECK (
      COALESCE(subtotal, 0) >= 0
      AND COALESCE(tax_amount, 0) >= 0
      AND COALESCE(tip_amount, 0) >= 0
      AND COALESCE(total_amount, 0) >= 0
    ),
  CONSTRAINT finance_receipt_drafts_ngo_hash_unique UNIQUE (ngo_id, content_sha256)
);

CREATE INDEX IF NOT EXISTS idx_finance_receipt_drafts_ngo_status
  ON public.finance_receipt_drafts(ngo_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_finance_receipt_drafts_document
  ON public.finance_receipt_drafts(document_id);
CREATE INDEX IF NOT EXISTS idx_finance_receipt_drafts_expense_account
  ON public.finance_receipt_drafts(suggested_expense_account_id);
CREATE INDEX IF NOT EXISTS idx_finance_receipt_drafts_payment_account
  ON public.finance_receipt_drafts(suggested_payment_account_id);

DROP TRIGGER IF EXISTS trg_finance_receipt_drafts_updated_at ON public.finance_receipt_drafts;
CREATE TRIGGER trg_finance_receipt_drafts_updated_at
  BEFORE UPDATE ON public.finance_receipt_drafts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.finance_receipt_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "finance receipt drafts read" ON public.finance_receipt_drafts;
CREATE POLICY "finance receipt drafts read"
  ON public.finance_receipt_drafts FOR SELECT TO authenticated
  USING (public.can_read_finance_ledger());

DROP POLICY IF EXISTS "finance receipt drafts manage" ON public.finance_receipt_drafts;
CREATE POLICY "finance receipt drafts manage"
  ON public.finance_receipt_drafts FOR ALL TO authenticated
  USING (public.is_finance_ledger_manager())
  WITH CHECK (public.is_finance_ledger_manager());

-- Called after the authenticated client uploads the private receipt object.
-- The advisory lock makes duplicate registration race-safe and prevents an
-- orphan document record when two users upload the same receipt at once.
CREATE OR REPLACE FUNCTION public.register_finance_receipt_draft(
  _ngo_id uuid,
  _file_path text,
  _file_name text,
  _file_type text,
  _file_size integer,
  _content_sha256 text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_hash text := lower(trim(COALESCE(_content_sha256, '')));
  normalized_name text := NULLIF(trim(_file_name), '');
  existing_draft public.finance_receipt_drafts;
  receipt_document public.documents;
  receipt_draft public.finance_receipt_drafts;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_finance_ledger_manager() THEN
    RAISE EXCEPTION 'Finance manager access required to analyze receipts';
  END IF;
  IF _ngo_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.ngos WHERE id = _ngo_id) THEN
    RAISE EXCEPTION 'Select a valid NGO before analyzing a receipt';
  END IF;
  IF _file_path NOT LIKE ('internal/finance/receipts/' || _ngo_id::text || '/%') THEN
    RAISE EXCEPTION 'Receipt storage path is outside the selected NGO finance folder';
  END IF;
  IF normalized_name IS NULL THEN
    RAISE EXCEPTION 'Receipt file name is required';
  END IF;
  IF COALESCE(_file_size, 0) <= 0 OR _file_size > 15728640 THEN
    RAISE EXCEPTION 'Receipt must be between 1 byte and 15 MB';
  END IF;
  IF COALESCE(_file_type, '') <> 'application/pdf'
     AND COALESCE(_file_type, '') NOT LIKE 'image/%' THEN
    RAISE EXCEPTION 'Receipt must be a PDF or image';
  END IF;
  IF normalized_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'A valid SHA-256 receipt fingerprint is required';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(_ngo_id::text || ':' || normalized_hash, 0));

  SELECT * INTO existing_draft
  FROM public.finance_receipt_drafts
  WHERE ngo_id = _ngo_id AND content_sha256 = normalized_hash;

  IF existing_draft.id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'draft', to_jsonb(existing_draft),
      'is_duplicate', true
    );
  END IF;

  INSERT INTO public.documents (
    ngo_id, file_path, file_name, file_type, file_size,
    category, uploaded_by_user_id, review_status, title
  ) VALUES (
    _ngo_id, _file_path, normalized_name, _file_type, _file_size,
    'finance', auth.uid(), 'pending', 'Receipt awaiting analysis — ' || normalized_name
  ) RETURNING * INTO receipt_document;

  INSERT INTO public.finance_receipt_drafts (
    ngo_id, document_id, content_sha256, created_by_user_id
  ) VALUES (
    _ngo_id, receipt_document.id, normalized_hash, auth.uid()
  ) RETURNING * INTO receipt_draft;

  PERFORM public.finance_log_audit_event(
    'finance_receipt_draft', receipt_draft.id, 'receipt_registered',
    jsonb_build_object(
      'ngo_id', _ngo_id,
      'document_id', receipt_document.id,
      'file_name', normalized_name,
      'content_sha256', normalized_hash
    )
  );

  RETURN jsonb_build_object(
    'draft', to_jsonb(receipt_draft),
    'is_duplicate', false
  );
END;
$$;

-- The review action and ledger posting are one database transaction.  A draft
-- cannot be marked posted unless the balanced payment and journal both exist.
CREATE OR REPLACE FUNCTION public.post_finance_receipt_draft(
  _receipt_draft_id uuid,
  _expense_account_id uuid,
  _payment_account_id uuid,
  _payment_method text,
  _payment_date date,
  _amount numeric,
  _payee_name text,
  _memo text DEFAULT NULL,
  _reference_number text DEFAULT NULL,
  _fund_id uuid DEFAULT NULL
)
RETURNS public.finance_payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  receipt_draft public.finance_receipt_drafts;
  payment public.finance_payments;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_finance_ledger_manager() THEN
    RAISE EXCEPTION 'Finance manager access required';
  END IF;

  SELECT * INTO receipt_draft
  FROM public.finance_receipt_drafts
  WHERE id = _receipt_draft_id
  FOR UPDATE;

  IF receipt_draft.id IS NULL THEN
    RAISE EXCEPTION 'Receipt draft not found';
  END IF;
  IF receipt_draft.status = 'posted' OR receipt_draft.posted_payment_id IS NOT NULL THEN
    RAISE EXCEPTION 'This receipt has already been posted';
  END IF;
  IF receipt_draft.status IN ('queued', 'processing') THEN
    RAISE EXCEPTION 'Receipt analysis is still in progress';
  END IF;

  payment := public.create_and_post_finance_expense_transaction(
    receipt_draft.ngo_id,
    _expense_account_id,
    _payment_account_id,
    _payment_method,
    _payment_date,
    _amount,
    _payee_name,
    _memo,
    _reference_number,
    receipt_draft.document_id,
    _fund_id,
    NULL,
    NULL,
    NULL,
    NULL
  );

  UPDATE public.finance_receipt_drafts
  SET status = 'posted',
      posted_payment_id = payment.id,
      error_message = NULL,
      updated_at = now()
  WHERE id = receipt_draft.id;

  UPDATE public.documents
  SET review_status = 'approved',
      reviewer_user_id = auth.uid(),
      reviewed_at = now(),
      review_notes = 'Reviewed and posted from receipt intelligence',
      title = 'Receipt — ' || trim(_payee_name),
      updated_at = now()
  WHERE id = receipt_draft.document_id;

  PERFORM public.finance_log_audit_event(
    'finance_receipt_draft', receipt_draft.id, 'reviewed_and_posted',
    jsonb_build_object(
      'payment_id', payment.id,
      'payment_number', payment.payment_number,
      'ngo_id', receipt_draft.ngo_id,
      'document_id', receipt_draft.document_id
    )
  );

  RETURN payment;
END;
$$;

REVOKE ALL ON FUNCTION public.register_finance_receipt_draft(
  uuid, text, text, text, integer, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_finance_receipt_draft(
  uuid, text, text, text, integer, text
) TO authenticated;

REVOKE ALL ON FUNCTION public.post_finance_receipt_draft(
  uuid, uuid, uuid, text, date, numeric, text, text, text, uuid
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.post_finance_receipt_draft(
  uuid, uuid, uuid, text, date, numeric, text, text, text, uuid
) TO authenticated;

