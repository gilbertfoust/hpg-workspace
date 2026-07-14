-- Prevent a previously approved prior-system comparison from being used after
-- the live ledger has changed inside its comparison window. The activation RPC
-- now recomputes all nine cutover metrics at the moment of activation.

CREATE OR REPLACE FUNCTION public.finance_parallel_close_is_current(_comparison_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  comparison public.finance_parallel_close_comparisons;
  current_metrics jsonb;
  current_variances jsonb;
  current_match boolean := false;
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_read_finance_ledger() THEN
    RAISE EXCEPTION 'Finance ledger access required';
  END IF;

  SELECT * INTO comparison
  FROM public.finance_parallel_close_comparisons
  WHERE id = _comparison_id;

  IF comparison.id IS NULL OR comparison.status <> 'approved' THEN
    RETURN false;
  END IF;

  current_metrics := public.finance_cutover_system_metrics(
    comparison.ngo_id,
    comparison.comparison_start_date,
    comparison.comparison_end_date
  );
  current_variances := public.finance_compare_cutover_metrics(
    current_metrics,
    comparison.prior_metrics
  );

  SELECT bool_and(abs((value #>> '{}')::numeric) <= comparison.tolerance)
  INTO current_match
  FROM jsonb_each(current_variances);

  RETURN COALESCE(current_match, false)
    AND COALESCE((current_metrics->>'ecosystem_is_balanced')::boolean, false);
END;
$$;

ALTER FUNCTION public.finance_go_live_readiness(uuid)
  RENAME TO finance_go_live_readiness_without_current_comparison;

REVOKE ALL ON FUNCTION public.finance_go_live_readiness_without_current_comparison(uuid)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.finance_go_live_readiness(_ngo_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base_readiness jsonb;
  certification public.finance_go_live_certifications;
  checks jsonb;
  blockers jsonb;
  comparison_is_current boolean := false;
  ready boolean := false;
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_read_finance_ledger() THEN
    RAISE EXCEPTION 'Finance ledger access required';
  END IF;

  base_readiness := public.finance_go_live_readiness_without_current_comparison(_ngo_id);
  SELECT * INTO certification
  FROM public.finance_go_live_certifications
  WHERE ngo_id = _ngo_id;

  IF certification.parallel_close_id IS NOT NULL THEN
    comparison_is_current := public.finance_parallel_close_is_current(
      certification.parallel_close_id
    );
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      CASE
        WHEN item->>'key' = 'parallel_close' THEN
          item || jsonb_build_object(
            'passed', COALESCE((item->>'passed')::boolean, false)
              AND comparison_is_current,
            'detail', CASE
              WHEN comparison_is_current
                THEN 'Approved comparison still matches the current ledger'
              ELSE 'Approved comparison is missing or stale; run it again'
            END
          )
        ELSE item
      END
      ORDER BY ordinal
    ),
    '[]'::jsonb
  ) INTO checks
  FROM jsonb_array_elements(base_readiness->'checks')
    WITH ORDINALITY AS expanded(item, ordinal);

  SELECT COALESCE(jsonb_agg(item->>'label'), '[]'::jsonb)
  INTO blockers
  FROM jsonb_array_elements(checks) item
  WHERE COALESCE((item->>'blocking')::boolean, false)
    AND NOT COALESCE((item->>'passed')::boolean, false);

  ready := jsonb_array_length(blockers) = 0;

  RETURN base_readiness || jsonb_build_object(
    'checks', checks,
    'blockers', blockers,
    'is_ready', ready,
    'checked_at', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.finance_parallel_close_is_current(uuid)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.finance_go_live_readiness(uuid)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.finance_parallel_close_is_current(uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.finance_go_live_readiness(uuid)
  TO authenticated;
