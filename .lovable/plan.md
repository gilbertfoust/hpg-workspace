

## HPG Financial Hub — Phase 2: Double-Entry Ledger Engine

### 1. Database Migration Plan

**New tables:**

```text
accounts
├── id (uuid PK)
├── ngo_id (uuid | null)  — null = global template
├── code (text)
├── name (text)
├── type (text: asset|liability|equity|income|expense)  — validated via trigger
├── parent_account_id (uuid | null FK → accounts)  — for sub-accounts
├── is_active (boolean, default true)
├── created_at (timestamptz)
└── updated_at (timestamptz)

transactions
├── id (uuid PK)
├── ngo_id (uuid, not null)
├── fiscal_period_id (uuid | null FK → fiscal_periods)
├── transaction_date (date)
├── description (text)
├── reference_number (text | null)
├── is_void (boolean, default false)
├── created_by_user_id (uuid | null)
├── created_at (timestamptz)
└── updated_at (timestamptz)

journal_entries
├── id (uuid PK)
├── transaction_id (uuid FK → transactions ON DELETE CASCADE)
├── account_id (uuid FK → accounts)
├── debit (numeric, default 0)
├── credit (numeric, default 0)
├── memo (text | null)
├── created_at (timestamptz)

receipts
├── id (uuid PK)
├── transaction_id (uuid FK → transactions ON DELETE CASCADE)
├── file_path (text)
├── file_name (text)
├── uploaded_by_user_id (uuid | null)
├── uploaded_at (timestamptz)

reconciliations
├── id (uuid PK)
├── ngo_id (uuid)
├── fiscal_period_id (uuid FK → fiscal_periods)
├── status (text: open|in_progress|closed)  — validated via trigger
├── reconciled_by_user_id (uuid | null)
├── reconciled_at (timestamptz | null)
├── notes (text | null)
├── created_at (timestamptz)
└── updated_at (timestamptz)
```

**Storage bucket:** `ledger-receipts` (private)

**Validation triggers:** One each for `accounts.type`, `reconciliations.status`, and a trigger on `journal_entries` insert/update to verify sum(debit) = sum(credit) per transaction.

**RLS policies (all tables):**
- SELECT: `is_internal_user() OR has_ngo_access(ngo_id)`
- INSERT: `is_internal_user() OR has_ngo_access(ngo_id)`
- UPDATE: `is_internal_user() OR has_ngo_access(ngo_id)`
- DELETE: `is_super_admin()`

### 2. Relationship to Phase 1

The existing `budget_categories` table is structurally similar to the new `accounts` table but serves a different purpose (budget line items vs. ledger accounts). They will coexist:

- **`budget_categories`** — continues to drive Budget vs Actual reporting
- **`accounts`** — drives the double-entry ledger (Chart of Accounts, GL, Trial Balance)
- **Integration point:** The `ReconciliationPanel` on the Period Detail page will compare journal entry totals (from `journal_entries` grouped by account type) against `actuals` totals to flag mismatches and allow closing a period.

### 3. New Hooks

| Hook | Purpose |
|------|---------|
| `useAccounts(ngoId?)` | CRUD for chart of accounts |
| `useTransactions(ngoId, filters?)` | List/create/void transactions |
| `useJournalEntries(transactionId?)` | Entries for a transaction |
| `useLedger(ngoId, accountId, dateRange?)` | GL entries + running balance |
| `useTrialBalance(ngoId, fiscalPeriodId)` | Aggregated debits/credits by account |
| `useReconciliation(ngoId, fiscalPeriodId)` | Reconciliation status + comparison |

### 4. New Components

| Component | Location | Description |
|-----------|----------|-------------|
| `TransactionForm` | `src/components/finance/TransactionForm.tsx` | Multi-line journal entry form with account selectors, debit/credit inputs, receipt upload, client-side balance validation |
| `TransactionsTable` | `src/components/finance/TransactionsTable.tsx` | Filterable list of transactions with date, description, total, void status |
| `JournalEntryTable` | `src/components/finance/JournalEntryTable.tsx` | Shows debit/credit lines for a single transaction |
| `AccountsTable` | `src/components/finance/AccountsTable.tsx` | Chart of accounts management with inline editing, type badges |
| `LedgerTable` | `src/components/finance/LedgerTable.tsx` | GL view: date, description, debit, credit, running balance per account |
| `TrialBalanceTable` | `src/components/finance/TrialBalanceTable.tsx` | Grouped by account type, debit/credit totals, balanced indicator |
| `ReconciliationPanel` | `src/components/finance/ReconciliationPanel.tsx` | Side-by-side comparison of journal totals vs actuals, close-period action |
| `AccountSelector` | `src/components/finance/AccountSelector.tsx` | Combobox for selecting accounts, grouped by type |
| `ReceiptUploader` | `src/components/finance/ReceiptUploader.tsx` | File upload to `ledger-receipts` bucket |

### 5. New Pages & Routing

| Route | Page | Description |
|-------|------|-------------|
| `/financial-hub/accounts` | `AccountsPage.tsx` | Chart of Accounts — NGO filter, create/edit accounts |
| `/financial-hub/transactions` | `TransactionsPage.tsx` | All transactions — NGO filter, date range, link to create |
| `/financial-hub/transactions/new` | `NewTransactionPage.tsx` | Transaction form (create) |
| `/financial-hub/ledger` | `GeneralLedgerPage.tsx` | GL — NGO filter, account filter, date range, beginning/ending balance |
| `/financial-hub/trial-balance` | `TrialBalancePage.tsx` | Trial Balance — NGO + period selectors |

All wrapped in `<ProtectedRoute>` and using `MainLayout`.

### 6. Sidebar Update

Add a collapsible sub-section under the existing "Financial Hub" nav item:

```text
Financial Hub          (existing, /financial-hub)
  ├── Accounts         (/financial-hub/accounts)
  ├── Transactions     (/financial-hub/transactions)
  ├── General Ledger   (/financial-hub/ledger)
  └── Trial Balance    (/financial-hub/trial-balance)
```

The sidebar `AppSidebar.tsx` will be updated to show a collapsible group when the current route starts with `/financial-hub`.

### 7. Period Detail Page Enhancements

Add two new sections to `PeriodDetail.tsx`:
- **Raw Transactions** — filtered `TransactionsTable` for that NGO + period
- **Reconciliation Status** — the `ReconciliationPanel` comparing journal totals vs actuals, with ability to mark period as closed

### 8. Implementation Order

1. **Database migration** — tables, triggers, RLS, storage bucket
2. **Hooks** — `useAccounts`, `useTransactions`, `useJournalEntries`, `useLedger`, `useTrialBalance`, `useReconciliation`
3. **Shared components** — `AccountSelector`, `ReceiptUploader`
4. **Chart of Accounts page** — `AccountsTable` + `AccountsPage`
5. **Transaction form + list** — `TransactionForm`, `TransactionsTable`, pages
6. **General Ledger page** — `LedgerTable` + `GeneralLedgerPage`
7. **Trial Balance page** — `TrialBalanceTable` + `TrialBalancePage`
8. **Reconciliation** — `ReconciliationPanel`, Period Detail integration
9. **Sidebar + routing** — update `AppSidebar`, `App.tsx`

