# Finance Permissions

Aligned with Supabase RLS helpers `is_finance_ledger_manager()` and `can_read_finance_ledger()`.

## Roles

| Capability | Super Admin / Admin / VP Finance | Internal staff (non-NGO) | NGO portal users |
|------------|----------------------------------|--------------------------|------------------|
| Read ledger | Yes | Yes | No |
| Create drafts | Yes | No* | No |
| Post / approve / void | Yes | No | No |
| Reconcile banks | Yes | No | No |
| Edit admin fee rules | Yes | No | No |

\*Draft creation RLS currently requires finance manager; Phase 44 UI disables post/void for non-managers. Future: finance staff draft-only role.

## App enforcement

- `src/lib/financePermissions.ts` — `hasFinancePermission`, `canReadFinanceLedger`
- Financial Hub blocks NGO users with `FinanceUnauthorized`
- Journal entry post/void/reverse buttons respect `post_journal` / `void_transaction`
- Route access still governed by `accessControl.ts` finance area

## Database

RLS on all `finance_*` tables: read via `can_read_finance_ledger()`, write via `is_finance_ledger_manager()`.
