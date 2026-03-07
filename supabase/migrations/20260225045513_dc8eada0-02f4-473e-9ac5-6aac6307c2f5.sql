
-- E-Signature Documents table (PDFs uploaded specifically for signing)
CREATE TABLE public.esign_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  original_filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.esign_documents ENABLE ROW LEVEL SECURITY;

-- All internal users can view e-sign documents
CREATE POLICY "Internal users can view esign documents"
  ON public.esign_documents FOR SELECT
  USING (is_internal_user());

-- Internal users can upload e-sign documents
CREATE POLICY "Internal users can upload esign documents"
  ON public.esign_documents FOR INSERT
  WITH CHECK (is_internal_user() AND auth.uid() = owner_id);

-- Owner or management can delete
CREATE POLICY "Owner or management can delete esign documents"
  ON public.esign_documents FOR DELETE
  USING (auth.uid() = owner_id OR is_management());

-- Signing requests table
CREATE TABLE public.signing_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES public.esign_documents(id) ON DELETE CASCADE,
  signer_name TEXT NOT NULL,
  signer_email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  signed_at TIMESTAMP WITH TIME ZONE,
  signer_ip TEXT,
  created_by_user_id UUID,
  ngo_id UUID REFERENCES public.ngos(id),
  work_item_id UUID REFERENCES public.work_items(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.signing_requests ENABLE ROW LEVEL SECURITY;

-- Internal users can view all signing requests
CREATE POLICY "Internal users can view signing requests"
  ON public.signing_requests FOR SELECT
  USING (is_internal_user());

-- Internal users can create signing requests
CREATE POLICY "Internal users can create signing requests"
  ON public.signing_requests FOR INSERT
  WITH CHECK (is_internal_user());

-- Internal users can update signing requests
CREATE POLICY "Internal users can update signing requests"
  ON public.signing_requests FOR UPDATE
  USING (is_internal_user());

-- Signed documents table
CREATE TABLE public.signed_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  signing_request_id UUID NOT NULL REFERENCES public.signing_requests(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.signed_documents ENABLE ROW LEVEL SECURITY;

-- Internal users can view signed documents
CREATE POLICY "Internal users can view signed documents"
  ON public.signed_documents FOR SELECT
  USING (is_internal_user());

-- Service role inserts signed documents (from edge function)
CREATE POLICY "Service role can insert signed documents"
  ON public.signed_documents FOR INSERT
  WITH CHECK (true);

-- Storage buckets for e-signature
INSERT INTO storage.buckets (id, name, public)
VALUES ('esign-documents', 'esign-documents', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('esign-signed-documents', 'esign-signed-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for esign-documents bucket
CREATE POLICY "Internal users can upload esign docs"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'esign-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Internal users can view esign docs"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'esign-documents');

CREATE POLICY "Internal users can delete esign docs"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'esign-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Storage policies for esign-signed-documents bucket
CREATE POLICY "View signed esign docs"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'esign-signed-documents');

CREATE POLICY "Upload signed esign docs"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'esign-signed-documents');

-- Helper function to get signing request by token with document info
CREATE OR REPLACE FUNCTION public.get_signing_request_by_token(request_token UUID)
RETURNS TABLE (
  id UUID,
  document_id UUID,
  signer_name TEXT,
  signer_email TEXT,
  status TEXT,
  token UUID,
  expires_at TIMESTAMP WITH TIME ZONE,
  signed_at TIMESTAMP WITH TIME ZONE,
  signer_ip TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  original_filename TEXT,
  storage_path TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    sr.id, sr.document_id, sr.signer_name, sr.signer_email,
    sr.status, sr.token, sr.expires_at, sr.signed_at, sr.signer_ip,
    sr.created_at, d.original_filename, d.storage_path
  FROM public.signing_requests sr
  JOIN public.esign_documents d ON d.id = sr.document_id
  WHERE sr.token = request_token;
$$;
