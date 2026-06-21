-- Phase 35: Finance document / receipt links for supporting evidence

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public' AND t.typname = 'finance_document_link_entity_type') THEN
    CREATE TYPE public.finance_document_link_entity_type AS ENUM (
      'journal_entry',
      'journal_line',
      'bill',
      'bill_payment',
      'payment',
      'deposit',
      'reimbursement'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.finance_document_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  entity_type public.finance_document_link_entity_type NOT NULL,
  entity_id uuid NOT NULL,
  link_notes text,
  created_by_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT finance_document_links_unique UNIQUE (document_id, entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_finance_document_links_entity
  ON public.finance_document_links(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_finance_document_links_document
  ON public.finance_document_links(document_id);

-- Returns true when a journal entry has at least one linked receipt/document
CREATE OR REPLACE FUNCTION public.finance_journal_entry_has_receipt(_entry_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.finance_document_links l
    WHERE l.entity_type = 'journal_entry'
      AND l.entity_id = _entry_id
  )
  OR EXISTS (
    SELECT 1
    FROM public.finance_document_links l
    JOIN public.finance_journal_lines jl ON jl.id = l.entity_id
    WHERE l.entity_type = 'journal_line'
      AND jl.journal_entry_id = _entry_id
  )
  OR EXISTS (
    SELECT 1
    FROM public.finance_journal_lines jl
    WHERE jl.journal_entry_id = _entry_id
      AND jl.document_id IS NOT NULL
  );
$$;

REVOKE ALL ON FUNCTION public.finance_journal_entry_has_receipt(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.finance_journal_entry_has_receipt(uuid) TO authenticated;

ALTER TABLE public.finance_document_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "finance document links read" ON public.finance_document_links;
CREATE POLICY "finance document links read"
  ON public.finance_document_links FOR SELECT TO authenticated
  USING (public.can_read_finance_ledger());

DROP POLICY IF EXISTS "finance document links manage" ON public.finance_document_links;
CREATE POLICY "finance document links manage"
  ON public.finance_document_links FOR ALL TO authenticated
  USING (public.is_finance_ledger_manager())
  WITH CHECK (public.is_finance_ledger_manager());
