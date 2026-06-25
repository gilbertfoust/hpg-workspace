-- Phase 8: Fiscal sponsorship — pass-through requests and restricted fund releases

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public' AND t.typname = 'finance_pass_through_status') THEN
    CREATE TYPE public.finance_pass_through_status AS ENUM ('pending', 'approved', 'disbursed', 'rejected', 'cancelled');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.finance_pass_through_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number text NOT NULL,
  deposit_id uuid REFERENCES public.finance_deposits(id) ON DELETE SET NULL,
  ngo_id uuid NOT NULL REFERENCES public.ngos(id) ON DELETE RESTRICT,
  fund_id uuid REFERENCES public.finance_funds(id) ON DELETE SET NULL,
  requested_amount numeric(18, 2) NOT NULL CHECK (requested_amount > 0),
  admin_fee_amount numeric(18, 2) NOT NULL DEFAULT 0,
  net_disbursement_amount numeric(18, 2) NOT NULL DEFAULT 0,
  restriction_type text,
  restriction_notes text,
  status public.finance_pass_through_status NOT NULL DEFAULT 'pending',
  requested_by_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_by_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at timestamptz,
  payment_id uuid REFERENCES public.finance_payments(id) ON DELETE SET NULL,
  memo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT finance_pass_through_requests_number_unique UNIQUE (request_number)
);

CREATE TABLE IF NOT EXISTS public.finance_restricted_fund_releases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  release_number text NOT NULL,
  fund_id uuid NOT NULL REFERENCES public.finance_funds(id) ON DELETE RESTRICT,
  ngo_id uuid REFERENCES public.ngos(id) ON DELETE SET NULL,
  release_date date NOT NULL DEFAULT CURRENT_DATE,
  amount numeric(18, 2) NOT NULL CHECK (amount > 0),
  from_restriction_class text NOT NULL,
  to_restriction_class text NOT NULL DEFAULT 'without_donor_restrictions',
  journal_entry_id uuid REFERENCES public.finance_journal_entries(id) ON DELETE SET NULL,
  memo text,
  created_by_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT finance_restricted_fund_releases_number_unique UNIQUE (release_number)
);

CREATE OR REPLACE FUNCTION public.approve_finance_pass_through_request(
  _request_id uuid,
  _admin_fee_amount numeric DEFAULT NULL
)
RETURNS public.finance_pass_through_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  req public.finance_pass_through_requests;
  fee numeric(18, 2);
BEGIN
  IF NOT public.is_finance_ledger_manager() THEN RAISE EXCEPTION 'Finance manager access required'; END IF;

  SELECT * INTO req FROM public.finance_pass_through_requests WHERE id = _request_id FOR UPDATE;
  IF req.id IS NULL THEN RAISE EXCEPTION 'Pass-through request not found'; END IF;
  IF req.status <> 'pending' THEN RAISE EXCEPTION 'Only pending requests can be approved'; END IF;

  fee := COALESCE(_admin_fee_amount, req.admin_fee_amount, 0);
  IF fee < 0 OR fee >= req.requested_amount THEN RAISE EXCEPTION 'Invalid admin fee amount'; END IF;

  UPDATE public.finance_pass_through_requests
  SET status = 'approved',
      admin_fee_amount = fee,
      net_disbursement_amount = req.requested_amount - fee,
      approved_by_user_id = auth.uid(),
      approved_at = now(),
      updated_at = now()
  WHERE id = _request_id
  RETURNING * INTO req;

  PERFORM public.finance_log_audit_event('finance_pass_through_request', req.id, 'approved',
    jsonb_build_object('admin_fee_amount', fee, 'net_disbursement_amount', req.net_disbursement_amount));
  RETURN req;
END;
$$;

CREATE OR REPLACE FUNCTION public.finance_ngo_subledger_balance(
  _ngo_id uuid,
  _as_of_date date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'ngo_id', _ngo_id,
    'as_of_date', _as_of_date,
    'unrestricted_balance', COALESCE(SUM(CASE WHEN f.fund_type = 'unrestricted' THEN l.credit - l.debit ELSE 0 END), 0),
    'restricted_balance', COALESCE(SUM(CASE WHEN f.fund_type IN ('donor_restricted', 'grant_restricted') THEN l.credit - l.debit ELSE 0 END), 0),
    'pass_through_balance', COALESCE(SUM(CASE WHEN f.fund_type = 'pass_through' THEN l.credit - l.debit ELSE 0 END), 0),
    'total_balance', COALESCE(SUM(l.credit - l.debit), 0)
  )
  FROM public.finance_journal_lines l
  JOIN public.finance_journal_entries e ON e.id = l.journal_entry_id
  LEFT JOIN public.finance_funds f ON f.id = l.fund_id
  WHERE e.status = 'posted'
    AND e.entry_date <= _as_of_date
    AND l.ngo_id = _ngo_id;
$$;

ALTER TABLE public.finance_pass_through_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_restricted_fund_releases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "finance pass through read" ON public.finance_pass_through_requests;
CREATE POLICY "finance pass through read" ON public.finance_pass_through_requests FOR SELECT TO authenticated USING (public.can_read_finance_ledger());
DROP POLICY IF EXISTS "finance pass through manage" ON public.finance_pass_through_requests;
CREATE POLICY "finance pass through manage" ON public.finance_pass_through_requests FOR ALL TO authenticated USING (public.is_finance_ledger_manager()) WITH CHECK (public.is_finance_ledger_manager());

DROP POLICY IF EXISTS "finance restricted releases read" ON public.finance_restricted_fund_releases;
CREATE POLICY "finance restricted releases read" ON public.finance_restricted_fund_releases FOR SELECT TO authenticated USING (public.can_read_finance_ledger());
DROP POLICY IF EXISTS "finance restricted releases manage" ON public.finance_restricted_fund_releases;
CREATE POLICY "finance restricted releases manage" ON public.finance_restricted_fund_releases FOR ALL TO authenticated USING (public.is_finance_ledger_manager()) WITH CHECK (public.is_finance_ledger_manager());

GRANT EXECUTE ON FUNCTION public.approve_finance_pass_through_request(uuid, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finance_ngo_subledger_balance(uuid, date) TO authenticated;
