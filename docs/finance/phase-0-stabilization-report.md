# Phase 0 — Finance Hub Stabilization & Verification Report

**Date:** 2026-06-21 (inspection pass)  
**Branch:** `dashboard-local-buildout` @ `1a028cb`  
**Supabase project:** `mlmjlgmsrkemsuwdohsa` — *HPG Application Database*  
**Inspector role:** Read-only verification; no destructive changes made.

---

## Executive summary

The Finance Hub has **two parallel accounting stacks**:

| Stack | Tables | Scope | UI routes |
|-------|--------|-------|-----------|
| **Legacy NGO ledger** | `accounts`, `transactions`, `journal_entries`, `fiscal_periods`, `opening_balances`, `bills`, `invoices` | Per-NGO | `/financial-hub/transactions`, `/journal`, legacy GL/trial balance |
| **New HPG ledger (`finance_*`)** | `finance_accounts`, `finance_journal_entries`, `finance_journal_lines`, AP, payments, deposits, etc. | Organization-wide | `/financial-hub/accounting/*` |

**Production schema:** All 11 finance bundle migrations (`20260621120000`–`20260621200000`) are **applied on remote** (local ↔ remote in sync per `supabase migration list`).

**Critical gaps before bookkeeping certification:**

1. **No atomic posting RPC** for legacy `transactions` + `journal_entries` (Phase 1 target).
2. **New `finance_*` draft save is multi-step** (header insert, then lines) — not a single DB transaction.
3. **`src/integrations/supabase/types.ts` has zero `finance_*` definitions** — all new hooks use `as never` casts.
4. **Dual AP / dual COA / dual reconciliation** — legacy pages still active alongside new accounting pages.
5. **Fiscal periods are NGO-scoped** and wired to legacy ledger only; `finance_journal_entries` has no `fiscal_period_id`.
6. **No AR module in `finance_*`** — legacy `invoices` only.
7. **Git working tree has modified already-applied migration files** — do not re-push without review.

---

## 1. Migration status

### Finance migrations (all applied local + remote)

| Migration | Purpose |
|-----------|---------|
| `20260621120000` | Core GL: accounts, funds, dimensions, journal entries/lines, audit, post/void/reverse RPCs, RLS |
| `20260621120100` | Starter COA seed (demo, empty-only) |
| `20260621120200` | Allow draft journal entry delete |
| `20260621130000` | Bank accounts + `finance_bank_account_ledger_balance` |
| `20260621140000` | Document links + `finance_journal_entry_has_receipt` |
| `20260621150000` | AP: vendors, bills, lines, payments; approve/pay/void RPCs |
| `20260621160000` | Payments/disbursements + post/void RPC |
| `20260621170000` | Deposits/revenue + `post_finance_deposit` |
| `20260621180000` | Admin fee rules + `finance_calculate_admin_fee` + demo seed |
| `20260621190000` | Bank reconciliation + `finalize_finance_bank_reconciliation` |
| `20260621200000` | Budgets + budget lines |

**Pending finance migrations:** None (all synced).

### Backup / non-active SQL

- `supabase/migration_backups/` — 6 `.bak` files (already outside `migrations/`). **OK — leave in place or `.gitignore`.**
- `supabase/.temp/` — CLI artifacts (`linked-project.json`, version pins). **Do not commit.**

### Git hygiene warning

Uncommitted changes detected on **already-applied** migrations:

- Modified: `20260301040056_*`, `20260524131000_*`, `20260524143000_*`
- Deleted/renamed: `20260613234000_*` → `20260613234001_*`, `20260614043000_*` → `20260614043001_*`

**Risk:** Re-running `supabase db push` against a fresh environment may diverge from production history. **Do not edit applied migrations;** use new forward-only migrations for fixes.

---

## 2. Finance Hub architecture map

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         FINANCIAL HUB (UI)                              │
├──────────────────────────────┬──────────────────────────────────────────┤
│  NEW: /accounting/*          │  LEGACY: /transactions, /accounts, etc.  │
│  FinancialHub command panel  │  NGO-scoped reporting & experiments      │
├──────────────────────────────┴──────────────────────────────────────────┤
│  Hooks (finance_*)           │  Hooks (legacy)                          │
│  useFinanceAccounts          │  useAccounts, useTransactions            │
│  useFinanceJournalEntries    │  useJournalEntries, useLedger            │
│  useFinanceBills/Vendors     │  useInvoices, useBills (legacy table)    │
│  useFinancePayments          │  useIntakeApproval                       │
│  useFinanceDeposits          │  useFiscalPeriods, useOpeningBalances    │
│  useFinanceReconciliation    │  useReconciliation, useBankReconciliations │
│  useFinanceReports           │  useTrialBalance, useFinancialStatements  │
├──────────────────────────────┴──────────────────────────────────────────┤
│                    Supabase (mlmjlgmsrkemsuwdohsa)                      │
├──────────────────────────────┬──────────────────────────────────────────┤
│  finance_* tables + RPCs     │  accounts, transactions, journal_entries │
│  RLS: is_finance_ledger_     │  fiscal_periods, opening_balances      │
│       manager / can_read_*   │  bills, invoices (NGO-scoped)            │
└──────────────────────────────┴──────────────────────────────────────────┘
```

### Cross-cutting

- **Documents:** `documents` + `finance_document_links`
- **Work items:** `work_items` (module `finance`) via upload routing
- **Access:** `src/lib/accessControl.ts` (route area `finance`), `src/lib/financePermissions.ts` (UI guards)
- **Dashboard:** `FinanceReadinessPanel`, `useFinanceHubSnapshot`, `useDashboardModuleSnapshots`

---

## 3. Schema inventory (`finance_*`)

### Tables (22)

`finance_accounts`, `finance_funds`, `finance_dimensions`, `finance_journal_entries`, `finance_journal_lines`, `finance_audit_events`, `finance_bank_accounts`, `finance_document_links`, `finance_vendors`, `finance_bills`, `finance_bill_lines`, `finance_bill_payments`, `finance_payments`, `finance_deposits`, `finance_deposit_lines`, `finance_admin_fee_rules`, `finance_bank_reconciliations`, `finance_bank_reconciliation_items`, `finance_budgets`, `finance_budget_lines`

### RPCs / functions

| Function | Purpose |
|----------|---------|
| `is_finance_ledger_manager()` | RLS helper |
| `can_read_finance_ledger()` | RLS helper |
| `finance_log_audit_event(...)` | Audit insert |
| `post_finance_journal_entry(uuid)` | Balance check + post |
| `void_finance_journal_entry(uuid, text)` | Void posted entry |
| `reverse_finance_journal_entry(uuid, date, text)` | Create + auto-post reversal |
| `finance_assign_journal_entry_number()` | Trigger helper |
| `finance_bank_account_ledger_balance(uuid)` | Cash balance |
| `finance_journal_entry_has_receipt(uuid)` | Receipt coverage |
| `approve_finance_bill(uuid)` | AP accrual JE |
| `pay_finance_bill(...)` | AP payment JE |
| `void_finance_bill(uuid, text)` | Void draft bill |
| `post_finance_payment(uuid)` | Payment/disbursement JE |
| `void_finance_payment(uuid, text)` | Void payment |
| `post_finance_deposit(uuid)` | Revenue JE |
| `finance_calculate_admin_fee(...)` | Admin fee split |
| `finalize_finance_bank_reconciliation(...)` | Lock recon |

### RLS pattern (all `finance_*` tables)

- **SELECT:** `can_read_finance_ledger()` — managers + internal non-NGO users
- **ALL (write):** `is_finance_ledger_manager()` — super_admin, admin_pm, vp_finance
- **Audit insert:** manager OR `actor_user_id = auth.uid()`

**Not yet implemented:** department-scoped read, finance staff draft-only write, NGO viewer, auditor read-only role at DB level.

---

## 4. Legacy schema (Phase 1 relevant)

| Table | In `types.ts` | Notes |
|-------|---------------|-------|
| `accounts` | Yes | NGO-scoped COA; rich statement mapping fields |
| `transactions` | Yes | Header; no `status` draft/posted enum in types |
| `journal_entries` | Yes | Lines linked by `transaction_id` |
| `fiscal_periods` | Yes | `is_locked`, NGO-scoped |
| `opening_balances` | Yes | NGO + period + account |
| `bills` / `invoices` | Yes | Legacy NGO AP/AR (separate from `finance_bills`) |

**Missing RPCs (Phase 1 asks for):** `post_transaction`, `save_draft_transaction`, `post_draft_transaction`, `void_transaction`, `reverse_transaction`, `generate_transaction_number`, `get_open_fiscal_period`, `validate_balanced_journal_lines` — **none exist in migrations**.

---

## 5. Frontend inventory

### New accounting routes (`/financial-hub/accounting/*`)

| Route | Page | Primary hooks |
|-------|------|---------------|
| `chart-of-accounts` | `FinanceChartOfAccountsPage` | `useFinanceAccounts` |
| `journal-entries` | `FinanceJournalEntriesPage` | `useFinanceJournalEntries` |
| `bank-accounts` | `FinanceBankAccountsPage` | `useFinanceBankAccounts` |
| `receipts` | `FinanceReceiptsPage` | `useFinanceDocumentLinks` |
| `accounts-payable` | `FinanceAccountsPayablePage` | `useFinanceBills`, `useFinanceVendors` |
| `payments` | `FinancePaymentsPage` | `useFinancePayments` |
| `deposits` | `FinanceDepositsPage` | `useFinanceDeposits` |
| `reconciliation` | `FinanceReconciliationPage` | `useFinanceReconciliation` |
| `budgets` | `FinanceBudgetsPage` | `useFinanceBudgets` |
| `reports` | `FinanceReportsPage` | `useFinanceReports` |

### Legacy finance routes (still mounted — 30+ routes)

Including: `transactions`, `accounts`, `ledger`, `trial-balance`, `journal`, `bills`, `invoices`, `opening-balances`, `reconciliation`, P&L, balance sheet, compliance, usage accounting, etc.

### New accounting components (`src/components/finance/accounting/`)

`FinanceAccountDialog`, `FinanceJournalEntryDialog`, `FinanceBankAccountDialog`, `FinanceBillDialog`, `FinanceBillPaymentDialog`, `FinanceVendorDialog`, `FinancePaymentDialog`, `FinanceDocumentLinkDialog`, `FinanceUnauthorized`

### Types

- `src/types/financeAccounting.ts` — manual TS types (not generated)
- `src/integrations/supabase/types.ts` — **no `finance_*` tables**

---

## 6. Schema ↔ frontend mismatch matrix

| Area | Schema | Frontend | Severity |
|------|--------|----------|----------|
| GL accounts | `finance_accounts.account_type` enum | Manual types match | Low |
| Journal save | Single entry + lines tables | Multi-request save in `useSaveFinanceJournalEntry` | **High** — partial failure risk |
| Journal post | `post_finance_journal_entry` RPC | Called correctly | OK |
| Legacy post | `transactions` + `journal_entries` | Two inserts in `useTransactions.create` | **High** — Phase 1 target |
| Fiscal periods | NGO `fiscal_periods` | Used by legacy only; not on `finance_*` | **Medium** — Phase 3 |
| COA classification | `finance_accounts.account_subtype` text | No 990/functional expense fields | **Medium** — Phase 2 |
| AP | `finance_bills` + RPCs | New AP page uses RPCs | OK |
| AP legacy | `bills` table | `BillsPage.tsx` still posts via `useTransactions` | **High** — duplicate |
| AR | `invoices` (legacy) | `InvoicesPage.tsx` | No `finance_*` AR |
| Bank recon | Two systems: legacy + `finance_bank_reconciliations` | Two UIs | **Medium** |
| Types | 20+ finance tables live | `types.ts` stale | **High** — DX & safety |
| Permissions | RLS manager-only writes | UI guards partial (journal post only) | **Medium** — Phase 9 |

---

## 7. What exists vs partial vs missing

### Exists (production foundation)

- Double-entry `finance_*` schema with immutability triggers on posted data
- Post / void / reverse for journal entries
- Chart of accounts UI + starter seed
- Journal entry UI with balance warnings
- Bank accounts with computed ledger balance RPC
- AP workflow with approve/pay RPCs posting JEs
- Payments, deposits, admin fee calculation, reconciliation finalize, budgets (basic)
- Core reports reading posted `finance_*` data
- Finance Hub dashboard snapshot + readiness panel
- Basic permission helpers + unauthorized state

### Partially implemented

- Receipt workflow (links + coverage; not on all entity types)
- Bank reconciliation (no statement PDF attachment field; limited item sources)
- Budget vs actual (simplified; not period-granular actuals)
- Fiscal sponsorship (admin fee on deposits; no full pass-through disbursement request workflow)
- Permissions (UI guards on journal only; RLS is binary manager vs read)
- Financial statements (P&L/BS in reports page; not full nonprofit statement specs)
- Audit trail (`finance_audit_events` exists; not all UI actions log)

### Missing (for 100% readiness)

- Atomic `post_transaction()` (legacy) and atomic `save_finance_journal_entry()` (new)
- Fiscal period integration with `finance_*` ledger
- Organization-wide period open/close/lock (current periods are NGO-scoped)
- Nonprofit COA classification (990, functional expense, restriction classes on accounts)
- Full nonprofit financial statements + cash flow + functional expense report
- `finance_*` AR (donors, invoices, pledges, grant receivable)
- NGO subledger views consolidated with HPG operating
- Restricted fund release entries
- Pass-through disbursement approval workflow end-to-end
- Year-end close package
- Form 990 support mappings
- Automated test suite / certification scripts
- Regenerated Supabase types

---

## 8. Gaps before Phase 1

1. **Clarify Phase 1 target ledger:** User spec references `post_transaction()` with NGO + fiscal period → **legacy model**. New `finance_*` ledger uses `finance_journal_entries` without a transaction header. **Recommendation:** Phase 1A = legacy atomic RPC; Phase 1B = `save_finance_journal_entry` atomic RPC for new ledger. Do not conflate.

2. **Regenerate types** before heavy Phase 1 coding (`supabase gen types`).

3. **Resolve git migration drift** — stash or revert local edits to applied migration files.

4. **Inventory production data** in both ledgers before posting engine changes.

5. **No `post_transaction` exists** — greenfield migration required.

6. **Legacy posting paths to update after RPC:**
   - `src/hooks/useTransactions.ts`
   - `src/pages/JournalEntryWorkspace.tsx`
   - `src/pages/TransactionsPage.tsx`
   - `src/hooks/useIntakeApproval.ts`
   - `src/pages/BillsPage.tsx` (legacy)
   - `src/pages/InvoicesPage.tsx` (if in scope)

---

## 9. Safe Phase 1 implementation plan (preview — do not start yet)

### Scope recommendation

**Phase 1 should target the legacy `transactions` + `journal_entries` path first** (per spec), while adding a parallel `save_finance_journal_entry(jsonb)` for the new ledger in the same migration file to avoid continued multi-step saves.

### Migration (new file only)

`20260622XXXXXX_atomic_transaction_posting.sql`:

1. `validate_balanced_journal_lines(jsonb)` → returns boolean + totals
2. `get_open_fiscal_period(uuid ngo_id, date)` → returns period or raises
3. `generate_transaction_number(uuid ngo_id)` → text
4. `save_draft_transaction(...)` → single transaction; status draft; lines optional
5. `post_transaction(...)` OR `post_draft_transaction(uuid)` → atomic header + lines + audit
6. `void_transaction(uuid, text)` → soft void + audit (no hard delete)
7. `reverse_transaction(uuid, date, text)` → reversal header + lines

All functions: `SECURITY DEFINER`, role checks via existing helpers or new `can_post_transactions()`.

### Frontend

1. Refactor `useTransactions.create` to call RPC only
2. Add draft save/edit/delete flows
3. Map RPC errors to user-facing toasts (unbalanced, locked period, inactive account)
4. Leave `finance_*` journal UI on separate RPC until 1B

### Tests

- SQL pgTAP or script: balanced post succeeds, unbalanced fails, locked period fails, partial failure leaves no rows

### Out of scope for Phase 1

- Merging legacy and `finance_*` ledgers
- Dropping legacy tables
- Fiscal period model changes for org-wide ledger

---

## 10. Commands to run before Phase 1 coding

```bash
# 1. Confirm migration sync (already verified — re-run after any pull)
npx supabase migration list

# 2. Regenerate TypeScript types from live schema
npx supabase gen types typescript --project-id mlmjlgmsrkemsuwdohsa > src/integrations/supabase/types.ts

# 3. Verify app env points to same project
# Check .env / .env.local: VITE_SUPABASE_URL should reference mlmjlgmsrkemsuwdohsa

# 4. Build sanity check
npm run build

# 5. Optional: inspect live finance table counts (read-only, service role or SQL editor)
# SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'finance_%';

# 6. Git: resolve dirty migration files BEFORE new migrations
git status supabase/migrations/
# Do NOT commit edits to already-applied migrations without DBA review
```

---

## 11. Risks and blockers

| Risk | Impact | Mitigation |
|------|--------|------------|
| Dual ledger confusion | Users post to wrong system | Phase 0 doc + eventual deprecation plan for legacy routes |
| Modified applied migrations in git | Drift on new environments | Revert or forward-only new migrations; never rewrite applied |
| No atomic legacy post | Partial transactions in DB | Phase 1 priority |
| `types.ts` stale | Runtime errors undetected at compile time | Regenerate before Phase 1 |
| RLS manager-only writes | Finance staff cannot draft | Phase 9 or Phase 1B policy addition |
| Legacy `BillsPage` + new AP both live | Double AP posting | Document; deprecate legacy in later phase |
| `void_finance_payment` marks void without reversing JE | Incorrect balances | Harden in Phase 9 |
| No automated tests | Regression risk | Phase 12 test harness |

---

## 12. Phase 0 completion checklist

- [x] Migration status confirmed (all finance migrations applied remote)
- [x] Finance tables inventory documented
- [x] RPC / RLS inventory documented
- [x] Routes, pages, hooks, components inventoried
- [x] Schema ↔ frontend mismatch listed
- [x] Architecture map produced
- [x] Phase 1 plan drafted (not executed)
- [x] Risks documented
- [ ] **User action:** Regenerate `types.ts`
- [ ] **User action:** Resolve git migration file dirtiness
- [ ] **User decision:** Confirm Phase 1 targets legacy vs `finance_*` vs both

**Phase 0 status: COMPLETE — awaiting approval to begin Phase 1.**
