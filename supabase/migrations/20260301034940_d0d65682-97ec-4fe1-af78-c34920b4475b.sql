
-- =============================================
-- Document Intake & Ledger Linking — Migration
-- =============================================

-- 1. document_intake_submissions
CREATE TABLE public.document_intake_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ngo_id uuid NOT NULL REFERENCES public.ngos(id),
  type text NOT NULL,
  status text NOT NULL DEFAULT 'submitted',
  file_path text,
  file_name text,
  submitted_by_user_id uuid,
  extracted_data_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  reviewer_user_id uuid,
  reviewer_notes text,
  fiscal_period_id uuid REFERENCES public.fiscal_periods(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.document_intake_submissions ENABLE ROW LEVEL SECURITY;

-- 2. document_to_transaction_links
CREATE TABLE public.document_to_transaction_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intake_id uuid NOT NULL REFERENCES public.document_intake_submissions(id),
  transaction_id uuid NOT NULL REFERENCES public.transactions(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.document_to_transaction_links ENABLE ROW LEVEL SECURITY;

-- 3. document_extraction_logs
CREATE TABLE public.document_extraction_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intake_id uuid NOT NULL REFERENCES public.document_intake_submissions(id),
  raw_text text,
  extracted_data_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  confidence_score numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.document_extraction_logs ENABLE ROW LEVEL SECURITY;

-- 4. Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('intake-documents', 'intake-documents', false);

-- =============================================
-- Validation triggers
-- =============================================

CREATE OR REPLACE FUNCTION public.validate_intake_type()
RETURNS trigger LANGUAGE plpgsql SET search_path = 'public' AS $$
BEGIN
  IF NEW.type NOT IN ('receipt', 'donation', 'grant_award', 'vendor_invoice', 'reimbursement', 'other') THEN
    RAISE EXCEPTION 'Invalid intake type: %. Must be receipt, donation, grant_award, vendor_invoice, reimbursement, or other.', NEW.type;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_intake_type
BEFORE INSERT OR UPDATE ON public.document_intake_submissions
FOR EACH ROW EXECUTE FUNCTION public.validate_intake_type();

CREATE OR REPLACE FUNCTION public.validate_intake_status()
RETURNS trigger LANGUAGE plpgsql SET search_path = 'public' AS $$
BEGIN
  IF NEW.status NOT IN ('submitted', 'extracted', 'processing', 'pending_review', 'approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid intake status: %. Must be submitted, extracted, processing, pending_review, approved, or rejected.', NEW.status;
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_intake_status
BEFORE INSERT OR UPDATE ON public.document_intake_submissions
FOR EACH ROW EXECUTE FUNCTION public.validate_intake_status();

-- =============================================
-- RLS Policies — document_intake_submissions
-- =============================================

CREATE POLICY "View intake submissions"
ON public.document_intake_submissions FOR SELECT
USING (is_internal_user() OR has_ngo_access(ngo_id));

CREATE POLICY "Insert intake submissions"
ON public.document_intake_submissions FOR INSERT
WITH CHECK (is_internal_user() OR has_ngo_access(ngo_id));

CREATE POLICY "Update intake submissions"
ON public.document_intake_submissions FOR UPDATE
USING (is_internal_user() OR has_ngo_access(ngo_id));

CREATE POLICY "Delete intake submissions"
ON public.document_intake_submissions FOR DELETE
USING (is_super_admin());

-- =============================================
-- RLS Policies — document_to_transaction_links
-- =============================================

CREATE POLICY "View transaction links"
ON public.document_to_transaction_links FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.document_intake_submissions s
  WHERE s.id = document_to_transaction_links.intake_id
  AND (is_internal_user() OR has_ngo_access(s.ngo_id))
));

CREATE POLICY "Insert transaction links"
ON public.document_to_transaction_links FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.document_intake_submissions s
  WHERE s.id = document_to_transaction_links.intake_id
  AND (is_internal_user() OR has_ngo_access(s.ngo_id))
));

CREATE POLICY "Update transaction links"
ON public.document_to_transaction_links FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.document_intake_submissions s
  WHERE s.id = document_to_transaction_links.intake_id
  AND (is_internal_user() OR has_ngo_access(s.ngo_id))
));

CREATE POLICY "Delete transaction links"
ON public.document_to_transaction_links FOR DELETE
USING (is_super_admin());

-- =============================================
-- RLS Policies — document_extraction_logs
-- =============================================

CREATE POLICY "View extraction logs"
ON public.document_extraction_logs FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.document_intake_submissions s
  WHERE s.id = document_extraction_logs.intake_id
  AND (is_internal_user() OR has_ngo_access(s.ngo_id))
));

CREATE POLICY "Insert extraction logs"
ON public.document_extraction_logs FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.document_intake_submissions s
  WHERE s.id = document_extraction_logs.intake_id
  AND (is_internal_user() OR has_ngo_access(s.ngo_id))
));

CREATE POLICY "Update extraction logs"
ON public.document_extraction_logs FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.document_intake_submissions s
  WHERE s.id = document_extraction_logs.intake_id
  AND (is_internal_user() OR has_ngo_access(s.ngo_id))
));

CREATE POLICY "Delete extraction logs"
ON public.document_extraction_logs FOR DELETE
USING (is_super_admin());

-- =============================================
-- Storage RLS for intake-documents bucket
-- =============================================

CREATE POLICY "Internal users can upload intake docs"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'intake-documents' AND is_internal_user());

CREATE POLICY "Internal users can view intake docs"
ON storage.objects FOR SELECT
USING (bucket_id = 'intake-documents' AND is_internal_user());

CREATE POLICY "Super admin can delete intake docs"
ON storage.objects FOR DELETE
USING (bucket_id = 'intake-documents' AND is_super_admin());
