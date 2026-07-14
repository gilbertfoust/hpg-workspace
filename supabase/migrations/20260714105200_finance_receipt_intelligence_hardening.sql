-- Receipt intelligence policy/index hardening after production advisor review.

CREATE INDEX IF NOT EXISTS idx_finance_receipt_drafts_created_by
  ON public.finance_receipt_drafts(created_by_user_id);

-- Keep the broader internal read policy, but split manager writes by command so
-- Finance managers do not evaluate two permissive SELECT policies.
DROP POLICY IF EXISTS "finance receipt drafts manage" ON public.finance_receipt_drafts;

DROP POLICY IF EXISTS "finance receipt drafts insert" ON public.finance_receipt_drafts;
CREATE POLICY "finance receipt drafts insert"
  ON public.finance_receipt_drafts FOR INSERT TO authenticated
  WITH CHECK (public.is_finance_ledger_manager());

DROP POLICY IF EXISTS "finance receipt drafts update" ON public.finance_receipt_drafts;
CREATE POLICY "finance receipt drafts update"
  ON public.finance_receipt_drafts FOR UPDATE TO authenticated
  USING (public.is_finance_ledger_manager())
  WITH CHECK (public.is_finance_ledger_manager());

DROP POLICY IF EXISTS "finance receipt drafts delete" ON public.finance_receipt_drafts;
CREATE POLICY "finance receipt drafts delete"
  ON public.finance_receipt_drafts FOR DELETE TO authenticated
  USING (public.is_finance_ledger_manager());

