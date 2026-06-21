-- Phase 12: Finance Hub QA certification seed (demo periods only, no fake transactions)

-- Demo fiscal periods for current and prior year (only if none exist)
INSERT INTO public.finance_fiscal_periods (label, fiscal_year, period_number, period_type, start_date, end_date, status)
SELECT * FROM (VALUES
  ('FY2025', 2025, 1, 'year', make_date(2025, 1, 1), make_date(2025, 12, 31), 'open'::public.finance_period_status),
  ('Jan 2026', 2026, 1, 'month', make_date(2026, 1, 1), make_date(2026, 1, 31), 'open'::public.finance_period_status),
  ('Feb 2026', 2026, 2, 'month', make_date(2026, 2, 1), make_date(2026, 2, 28), 'open'::public.finance_period_status),
  ('Mar 2026', 2026, 3, 'month', make_date(2026, 3, 1), make_date(2026, 3, 31), 'open'::public.finance_period_status),
  ('Apr 2026', 2026, 4, 'month', make_date(2026, 4, 1), make_date(2026, 4, 30), 'open'::public.finance_period_status),
  ('May 2026', 2026, 5, 'month', make_date(2026, 5, 1), make_date(2026, 5, 31), 'open'::public.finance_period_status),
  ('Jun 2026', 2026, 6, 'month', make_date(2026, 6, 1), make_date(2026, 6, 30), 'open'::public.finance_period_status),
  ('FY2026', 2026, 1, 'year', make_date(2026, 1, 1), make_date(2026, 12, 31), 'open'::public.finance_period_status)
) AS seed(label, fiscal_year, period_number, period_type, start_date, end_date, status)
WHERE NOT EXISTS (SELECT 1 FROM public.finance_fiscal_periods LIMIT 1);

COMMENT ON TABLE public.finance_fiscal_periods IS 'Finance Hub org-wide fiscal periods. Demo seed in phase 12 migration is labeled and only inserts when table is empty.';
