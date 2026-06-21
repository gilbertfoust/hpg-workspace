# Finance Hub Accounting Architecture

HPG Workspace implements organization-wide double-entry accounting in `finance_*` tables, separate from the legacy NGO-scoped `accounts` / `transactions` / `journal_entries` ledger.

## Core principles

- **Double-entry:** every posted journal entry balances (debits = credits).
- **Immutability:** posted entries cannot be edited; use void or reverse RPCs.
- **Fund accounting:** dimensions via `finance_funds`, NGO, department, grant application, and `finance_dimensions`.
- **Audit trail:** `finance_audit_events` logs post, void, reverse, and key workflow actions.

## Schema layers

| Layer | Tables |
|-------|--------|
| GL | `finance_accounts`, `finance_journal_entries`, `finance_journal_lines` |
| Funds | `finance_funds`, `finance_dimensions` |
| Cash | `finance_bank_accounts` |
| AP | `finance_vendors`, `finance_bills`, `finance_bill_lines`, `finance_bill_payments` |
| Payments | `finance_payments` |
| Revenue | `finance_deposits`, `finance_deposit_lines` |
| Admin fees | `finance_admin_fee_rules` |
| Reconciliation | `finance_bank_reconciliations`, `finance_bank_reconciliation_items` |
| Budgets | `finance_budgets`, `finance_budget_lines` |
| Evidence | `finance_document_links`, `documents` |

## RPCs

- `post_finance_journal_entry`, `void_finance_journal_entry`, `reverse_finance_journal_entry`
- `approve_finance_bill`, `pay_finance_bill`, `void_finance_bill`
- `post_finance_payment`, `void_finance_payment`
- `post_finance_deposit`
- `finance_calculate_admin_fee`
- `finalize_finance_bank_reconciliation`
- `finance_journal_entry_has_receipt`, `finance_bank_account_ledger_balance`

## UI routes

All under `/financial-hub/accounting/*` — see Financial Hub command panel.

## Deployment

Apply migrations `20260621120000` through `20260621200000` locally. Do not use live financial seed data in production without labeling.
