-- Phase 34: Bank / cash account management for HPG accounting ledger

CREATE TABLE IF NOT EXISTS public.finance_bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_name text NOT NULL,
  institution_name text,
  last_four text,
  linked_finance_account_id uuid NOT NULL REFERENCES public.finance_accounts(id) ON DELETE RESTRICT,
  opening_balance numeric(18, 2) NOT NULL DEFAULT 0,
  opening_balance_date date NOT NULL DEFAULT CURRENT_DATE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT finance_bank_accounts_name_not_empty CHECK (char_length(trim(account_name)) > 0),
  CONSTRAINT finance_bank_accounts_last_four_format CHECK (
    last_four IS NULL OR last_four ~ '^\d{4}$'
  )
);

CREATE INDEX IF NOT EXISTS idx_finance_bank_accounts_linked_account
  ON public.finance_bank_accounts(linked_finance_account_id);

CREATE INDEX IF NOT EXISTS idx_finance_bank_accounts_active
  ON public.finance_bank_accounts(is_active);

DROP TRIGGER IF EXISTS trg_finance_bank_accounts_updated_at ON public.finance_bank_accounts;
CREATE TRIGGER trg_finance_bank_accounts_updated_at
  BEFORE UPDATE ON public.finance_bank_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Ledger balance = opening balance + net posted journal activity on linked GL account
CREATE OR REPLACE FUNCTION public.finance_bank_account_ledger_balance(_bank_account_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ba.opening_balance
    + COALESCE((
      SELECT SUM(l.debit - l.credit)
      FROM public.finance_journal_lines l
      JOIN public.finance_journal_entries e ON e.id = l.journal_entry_id
      WHERE l.account_id = ba.linked_finance_account_id
        AND e.status = 'posted'
    ), 0)
  FROM public.finance_bank_accounts ba
  WHERE ba.id = _bank_account_id;
$$;

REVOKE ALL ON FUNCTION public.finance_bank_account_ledger_balance(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.finance_bank_account_ledger_balance(uuid) TO authenticated;

ALTER TABLE public.finance_bank_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "finance bank accounts read" ON public.finance_bank_accounts;
CREATE POLICY "finance bank accounts read"
  ON public.finance_bank_accounts FOR SELECT TO authenticated
  USING (public.can_read_finance_ledger());

DROP POLICY IF EXISTS "finance bank accounts manage" ON public.finance_bank_accounts;
CREATE POLICY "finance bank accounts manage"
  ON public.finance_bank_accounts FOR ALL TO authenticated
  USING (public.is_finance_ledger_manager())
  WITH CHECK (public.is_finance_ledger_manager());
