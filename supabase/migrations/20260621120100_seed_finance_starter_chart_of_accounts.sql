-- Starter nonprofit chart of accounts (DEMO / SEED ONLY)
-- Inserts only when finance_accounts is empty. Safe to run in dev/staging.

INSERT INTO public.finance_accounts (code, name, account_type, account_subtype, normal_balance, is_active)
SELECT v.code, v.name, v.account_type::public.finance_account_type, v.account_subtype, v.normal_balance::public.finance_normal_balance, true
FROM (
  VALUES
    ('1000', 'Cash / Bank', 'asset', 'cash', 'debit'),
    ('1100', 'Accounts Receivable', 'asset', 'receivable', 'debit'),
    ('1200', 'Grants Receivable', 'asset', 'grants_receivable', 'debit'),
    ('1300', 'Prepaid Expenses', 'asset', 'prepaid', 'debit'),
    ('2000', 'Accounts Payable', 'liability', 'payable', 'credit'),
    ('2100', 'Deferred Revenue', 'liability', 'deferred_revenue', 'credit'),
    ('3000', 'Net Assets Without Donor Restrictions', 'equity', 'unrestricted', 'credit'),
    ('3100', 'Net Assets With Donor Restrictions', 'equity', 'restricted', 'credit'),
    ('4000', 'Contributions', 'revenue', 'contributions', 'credit'),
    ('4100', 'Grants Revenue', 'revenue', 'grants', 'credit'),
    ('4200', 'Program Service Revenue', 'revenue', 'program_service', 'credit'),
    ('4300', 'Fiscal Sponsorship Admin Fees', 'revenue', 'admin_fees', 'credit'),
    ('5000', 'Program Expenses', 'expense', 'program', 'debit'),
    ('5100', 'Grant Disbursements', 'expense', 'grant_disbursement', 'debit'),
    ('5200', 'Professional Fees', 'expense', 'professional', 'debit'),
    ('5300', 'Software / Technology', 'expense', 'technology', 'debit'),
    ('5400', 'Fundraising Expense', 'expense', 'fundraising', 'debit'),
    ('5500', 'Administrative Expense', 'expense', 'administrative', 'debit')
) AS v(code, name, account_type, account_subtype, normal_balance)
WHERE NOT EXISTS (SELECT 1 FROM public.finance_accounts LIMIT 1);
