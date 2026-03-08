
CREATE TABLE public.saved_ledger_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ngo_id uuid NOT NULL REFERENCES public.ngos(id) ON DELETE CASCADE,
  transaction_id uuid NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  title text NOT NULL,
  html_content text NOT NULL,
  saved_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.saved_ledger_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View saved ledger documents" ON public.saved_ledger_documents
  FOR SELECT TO authenticated
  USING (is_internal_user() OR has_ngo_access(ngo_id));

CREATE POLICY "Insert saved ledger documents" ON public.saved_ledger_documents
  FOR INSERT TO authenticated
  WITH CHECK (is_internal_user() OR has_ngo_access(ngo_id));

CREATE POLICY "Delete saved ledger documents" ON public.saved_ledger_documents
  FOR DELETE TO authenticated
  USING (is_super_admin() OR saved_by_user_id = auth.uid());
