-- Phase 9: Audit trail, permissions, and internal controls

CREATE OR REPLACE FUNCTION public.is_finance_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_finance_ledger_manager()
    OR public.has_role(auth.uid(), 'staff')
    OR public.has_role(auth.uid(), 'staff_member');
$$;

CREATE OR REPLACE FUNCTION public.can_write_finance_drafts()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_finance_ledger_manager() OR public.is_finance_staff();
$$;

CREATE OR REPLACE FUNCTION public.is_finance_auditor()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'viewer')
    OR public.has_role(auth.uid(), 'board');
$$;

-- Draft journal entry insert/update for finance staff (managers retain full access via existing policies)
DROP POLICY IF EXISTS "finance journal entries draft write" ON public.finance_journal_entries;
CREATE POLICY "finance journal entries draft write"
  ON public.finance_journal_entries FOR INSERT TO authenticated
  WITH CHECK (public.can_write_finance_drafts() AND status = 'draft');

DROP POLICY IF EXISTS "finance journal lines draft write" ON public.finance_journal_lines;
CREATE POLICY "finance journal lines draft write"
  ON public.finance_journal_lines FOR INSERT TO authenticated
  WITH CHECK (
    public.can_write_finance_drafts()
    AND EXISTS (
      SELECT 1 FROM public.finance_journal_entries e
      WHERE e.id = journal_entry_id AND e.status = 'draft'
    )
  );

CREATE TABLE IF NOT EXISTS public.finance_export_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type text NOT NULL,
  filters_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  exported_by_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.finance_export_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "finance export log read" ON public.finance_export_log;
CREATE POLICY "finance export log read" ON public.finance_export_log FOR SELECT TO authenticated USING (public.is_finance_ledger_manager() OR public.is_finance_auditor());
DROP POLICY IF EXISTS "finance export log insert" ON public.finance_export_log;
CREATE POLICY "finance export log insert" ON public.finance_export_log FOR INSERT TO authenticated WITH CHECK (public.can_read_finance_ledger());

CREATE OR REPLACE FUNCTION public.log_finance_export(_report_type text, _filters jsonb DEFAULT '{}'::jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.finance_export_log (report_type, filters_json, exported_by_user_id)
  VALUES (_report_type, COALESCE(_filters, '{}'::jsonb), auth.uid());
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_finance_export(text, jsonb) TO authenticated;
