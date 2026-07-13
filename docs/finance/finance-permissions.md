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
| Read notification outbox | Yes | Yes | No | No | No |

## App enforcement

- `src/lib/financePermissions.ts` — `hasFinancePermission`, `canReadFinanceLedger`
- `get_finance_access_capabilities()` — authoritative workflow controls returned by the database
- Financial Hub blocks NGO users with `FinanceUnauthorized`
- Journal entry post/void/reverse buttons respect `post_journal` / `void_transaction`
- Operations, purchase, and budget buttons respect database-returned capabilities
- Route access still governed by `accessControl.ts` finance area

## Database

RLS is enabled on every `finance_*` table. Ledger read policies use `can_read_finance_ledger()`. Draft preparation uses the Finance-department-scoped `is_finance_staff()`. Approval and posting RPCs require `is_finance_ledger_manager()`.

Direct Data API writes to operational workflow tables are revoked; expense, purchase, and budget state changes must use their authority-checked RPCs.
