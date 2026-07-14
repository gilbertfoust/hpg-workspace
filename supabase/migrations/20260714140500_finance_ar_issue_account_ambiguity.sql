-- Forward repair for projects that applied Phase 14 before the ambiguity was
-- caught by the rollback-only ecosystem smoke test.
CREATE OR REPLACE FUNCTION public.issue_finance_invoice(_invoice_id uuid)
RETURNS public.finance_invoices
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  invoice public.finance_invoices;
  entry public.finance_journal_entries;
  resolved_receivable_account_id uuid;
  line_count integer;
  invoice_total numeric(18,2);
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_finance_ledger_manager() THEN RAISE EXCEPTION 'Finance manager access required'; END IF;
  SELECT * INTO invoice FROM public.finance_invoices WHERE id = _invoice_id FOR UPDATE;
  IF invoice.id IS NULL THEN RAISE EXCEPTION 'Invoice not found'; END IF;
  IF invoice.status NOT IN ('draft', 'sent') OR invoice.journal_entry_id IS NOT NULL THEN
    RAISE EXCEPTION 'Only an unposted draft invoice can be issued';
  END IF;
  SELECT count(*), round(COALESCE(sum(amount), 0), 2)
  INTO line_count, invoice_total FROM public.finance_invoice_lines WHERE invoice_id = invoice.id;
  IF line_count = 0 OR invoice_total <= 0 THEN RAISE EXCEPTION 'Invoice must contain positive revenue lines'; END IF;
  IF invoice.ngo_id IS NULL THEN RAISE EXCEPTION 'Invoice must belong to an NGO'; END IF;

  resolved_receivable_account_id := public.finance_resolve_accounts_receivable_account_id();
  IF resolved_receivable_account_id IS NULL THEN RAISE EXCEPTION 'Accounts Receivable control account not found'; END IF;
  PERFORM public.ensure_finance_ngo_account(invoice.ngo_id, resolved_receivable_account_id, '{}'::jsonb, 'invoice', invoice.id);

  INSERT INTO public.finance_journal_entries (
    entry_date, memo, source_type, source_id, status, created_by_user_id, ngo_id
  ) VALUES (
    invoice.invoice_date, COALESCE(invoice.memo, 'Invoice ' || invoice.invoice_number),
    'finance_invoice', invoice.id, 'draft', auth.uid(), invoice.ngo_id
  ) RETURNING * INTO entry;

  INSERT INTO public.finance_journal_lines (
    journal_entry_id, account_id, debit, credit, memo, ngo_id, document_id, line_number
  ) VALUES (
    entry.id, resolved_receivable_account_id, invoice_total, 0,
    'Accounts Receivable — ' || invoice.invoice_number,
    invoice.ngo_id, invoice.document_id, 1
  );

  INSERT INTO public.finance_journal_lines (
    journal_entry_id, account_id, debit, credit, memo, fund_id,
    ngo_id, grant_application_id, document_id, line_number
  )
  SELECT entry.id, line.account_id, 0, line.amount, line.description,
    line.fund_id, invoice.ngo_id, invoice.grant_application_id,
    invoice.document_id, line.line_number + 1
  FROM public.finance_invoice_lines line
  WHERE line.invoice_id = invoice.id ORDER BY line.line_number;

  entry := public.post_finance_journal_entry(entry.id);
  PERFORM set_config('hpg.finance_ar_rpc', 'on', true);
  UPDATE public.finance_invoices
  SET status = 'sent', subtotal = invoice_total, total = invoice_total,
      receivable_account_id = resolved_receivable_account_id,
      journal_entry_id = entry.id, issued_at = now(), updated_at = now()
  WHERE id = invoice.id RETURNING * INTO invoice;

  IF invoice.document_id IS NOT NULL THEN
    INSERT INTO public.finance_document_links (
      document_id, entity_type, entity_id, link_notes, created_by_user_id
    ) VALUES
      (invoice.document_id, 'journal_entry', entry.id, 'Invoice supporting document', auth.uid())
    ON CONFLICT DO NOTHING;
  END IF;
  PERFORM public.finance_log_audit_event(
    'finance_invoice', invoice.id, 'issued',
    jsonb_build_object('ngo_id', invoice.ngo_id, 'total', invoice.total, 'journal_entry_id', entry.id)
  );
  RETURN invoice;
END;
$$;

REVOKE ALL ON FUNCTION public.issue_finance_invoice(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.issue_finance_invoice(uuid) TO authenticated;
