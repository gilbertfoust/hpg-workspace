-- Monthly periods are the only posting periods. Quarter and year records are
-- close/reporting rollups and must never let a journal bypass a locked month.

CREATE OR REPLACE FUNCTION public.get_finance_open_fiscal_period(
  _entry_date date,
  _fiscal_period_id uuid,
  _ngo_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  resolved_id uuid;
BEGIN
  IF _fiscal_period_id IS NOT NULL THEN
    SELECT period.id INTO resolved_id
    FROM public.finance_fiscal_periods period
    WHERE period.id = _fiscal_period_id
      AND period.ngo_id IS NOT DISTINCT FROM _ngo_id
      AND period.period_type = 'month'
      AND _entry_date BETWEEN period.start_date AND period.end_date
      AND period.status = 'open';

    IF resolved_id IS NULL THEN
      RAISE EXCEPTION 'Monthly fiscal period is missing, belongs to another entity, is closed or locked, or does not cover entry date %', _entry_date;
    END IF;
    RETURN resolved_id;
  END IF;

  SELECT period.id INTO resolved_id
  FROM public.finance_fiscal_periods period
  WHERE period.ngo_id IS NOT DISTINCT FROM _ngo_id
    AND period.period_type = 'month'
    AND _entry_date BETWEEN period.start_date AND period.end_date
    AND period.status = 'open'
  ORDER BY period.start_date DESC
  LIMIT 1;

  IF resolved_id IS NULL THEN
    RAISE EXCEPTION 'No open monthly finance fiscal period found for this entity on date %', _entry_date;
  END IF;
  RETURN resolved_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_finance_open_fiscal_period(date, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_finance_open_fiscal_period(date, uuid, uuid) TO authenticated;
