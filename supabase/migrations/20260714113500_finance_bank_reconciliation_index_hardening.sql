-- Cover reconciliation foreign keys identified by the production advisor.

CREATE INDEX IF NOT EXISTS idx_finance_bank_recon_items_journal_line
  ON public.finance_bank_reconciliation_items(journal_line_id);
CREATE INDEX IF NOT EXISTS idx_finance_bank_recon_items_bill_payment
  ON public.finance_bank_reconciliation_items(bill_payment_id);
CREATE INDEX IF NOT EXISTS idx_finance_bank_recon_items_payment
  ON public.finance_bank_reconciliation_items(payment_id);
CREATE INDEX IF NOT EXISTS idx_finance_bank_recon_items_deposit
  ON public.finance_bank_reconciliation_items(deposit_id);

CREATE INDEX IF NOT EXISTS idx_finance_bank_reconciliations_created_by
  ON public.finance_bank_reconciliations(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_finance_bank_reconciliations_finalized_by
  ON public.finance_bank_reconciliations(finalized_by_user_id);
CREATE INDEX IF NOT EXISTS idx_finance_bank_reconciliations_approved_by
  ON public.finance_bank_reconciliations(approved_by_user_id);
CREATE INDEX IF NOT EXISTS idx_finance_bank_reconciliations_statement_document
  ON public.finance_bank_reconciliations(statement_document_id);

CREATE INDEX IF NOT EXISTS idx_finance_bank_statement_transactions_matched_by
  ON public.finance_bank_statement_transactions(matched_by_user_id);

