-- Let Finance resolve an unreadable or mistakenly uploaded receipt without
-- losing its document or audit evidence. The unresolved draft is removed so it
-- no longer blocks period close; the source document is retained as rejected.

CREATE OR REPLACE FUNCTION public.dismiss_finance_receipt_draft(
  _receipt_draft_id uuid,
  _reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  receipt_draft public.finance_receipt_drafts;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_finance_ledger_manager() THEN
    RAISE EXCEPTION 'Finance manager access required';
  END IF;
  IF NULLIF(trim(_reason), '') IS NULL THEN
    RAISE EXCEPTION 'Dismissal reason is required';
  END IF;

  SELECT * INTO receipt_draft
  FROM public.finance_receipt_drafts
  WHERE id = _receipt_draft_id
  FOR UPDATE;
  IF receipt_draft.id IS NULL THEN RAISE EXCEPTION 'Receipt draft not found'; END IF;
  IF receipt_draft.status = 'posted' OR receipt_draft.posted_payment_id IS NOT NULL THEN
    RAISE EXCEPTION 'A posted receipt cannot be dismissed; void or reverse its transaction instead';
  END IF;
  IF receipt_draft.status IN ('queued', 'processing') THEN
    RAISE EXCEPTION 'Wait for receipt analysis to finish before dismissing it';
  END IF;

  UPDATE public.documents
  SET review_status = 'rejected',
      reviewer_user_id = auth.uid(),
      reviewed_at = now(),
      review_notes = 'Receipt draft dismissed: ' || trim(_reason),
      updated_at = now()
  WHERE id = receipt_draft.document_id;

  DELETE FROM public.finance_receipt_drafts WHERE id = receipt_draft.id;

  PERFORM public.finance_log_audit_event(
    'finance_receipt_draft', receipt_draft.id, 'dismissed',
    jsonb_build_object(
      'ngo_id', receipt_draft.ngo_id,
      'document_id', receipt_draft.document_id,
      'content_sha256', receipt_draft.content_sha256,
      'previous_status', receipt_draft.status,
      'reason', trim(_reason)
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.dismiss_finance_receipt_draft(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dismiss_finance_receipt_draft(uuid, text) TO authenticated;
