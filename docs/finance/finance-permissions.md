# Finance Permissions

Aligned with Supabase RLS helpers `is_finance_ledger_manager()`, `is_finance_staff()`, and `can_read_finance_ledger()`.

## Roles

| Capability | Finance manager | Finance-department staff | Other internal staff | Auditor / board | NGO portal users |
|------------|-----------------|--------------------------|----------------------|-----------------|------------------|
| Read ledger | Yes | Yes | Yes | Yes | No |
| Create journal drafts | Yes | Yes | No | No | No |
| Prepare budgets | Yes | Yes | No | No | No |
| Submit own expense / purchase request | Yes | Yes | Yes | No | No |
| Approve requests or budgets | Yes | No | No | No | No |
| Post / approve / void ledger activity | Yes | No | No | No | No |
| Reconcile banks | Yes | No | No | No | No |
| Import/post opening balances | Yes | No | No | No | No |
| Close, lock, or reopen periods | Yes | No | No | No | No |
| Finalize or reopen a fiscal year | Yes | No | No | No | No |
| Generate/read official reports | Yes | Yes | Yes | Yes | No |
| Read notification outbox | Yes | Yes | No | No | No |

## App enforcement

- `src/lib/financePermissions.ts` — `hasFinancePermission`, `canReadFinanceLedger`
- `get_finance_access_capabilities()` — authoritative workflow controls returned by the database
- Financial Hub blocks NGO users with `FinanceUnauthorized`
- Journal entry post/void/reverse buttons respect `post_journal` / `void_transaction`
- Operations, purchase, and budget buttons respect database-returned capabilities
- Receipt extraction can create a draft, but only a Finance manager can confirm accounts and post it
- Period and year-end buttons display database readiness; the mutation repeats the check atomically
- Auditors can read locked reports and packages but cannot change ledger state
- Route access still governed by `accessControl.ts` finance area

## Database

RLS is enabled on every `finance_*` table. Ledger read policies use `can_read_finance_ledger()`. Draft preparation uses the Finance-department-scoped `is_finance_staff()`. Approval and posting RPCs require `is_finance_ledger_manager()`.

Direct Data API writes to operational workflow tables are revoked; expense, purchase, and budget state changes must use their authority-checked RPCs. Opening-balance triggers reject edits outside an open, unposted monthly period. Close, lock, reconciliation, and year-end functions independently verify the signed-in Finance-manager role.
