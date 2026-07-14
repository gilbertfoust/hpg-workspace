-- Keep the current-comparison helper internal to the guarded readiness RPC and
-- add covering indexes for every cutover foreign key used during evidence and
-- user lifecycle operations.

REVOKE ALL ON FUNCTION public.finance_parallel_close_is_current(uuid)
  FROM PUBLIC, anon, authenticated;

CREATE INDEX IF NOT EXISTS idx_fin_go_live_parallel_close
  ON public.finance_go_live_certifications(parallel_close_id);
CREATE INDEX IF NOT EXISTS idx_fin_go_live_signoff_doc
  ON public.finance_go_live_certifications(accountant_signoff_document_id);
CREATE INDEX IF NOT EXISTS idx_fin_go_live_created_by
  ON public.finance_go_live_certifications(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_fin_go_live_activated_by
  ON public.finance_go_live_certifications(activated_by_user_id);
CREATE INDEX IF NOT EXISTS idx_fin_go_live_suspended_by
  ON public.finance_go_live_certifications(suspended_by_user_id);

CREATE INDEX IF NOT EXISTS idx_fin_parallel_prior_doc
  ON public.finance_parallel_close_comparisons(prior_source_document_id);
CREATE INDEX IF NOT EXISTS idx_fin_parallel_prepared_by
  ON public.finance_parallel_close_comparisons(prepared_by_user_id);
CREATE INDEX IF NOT EXISTS idx_fin_parallel_approved_by
  ON public.finance_parallel_close_comparisons(approved_by_user_id);
