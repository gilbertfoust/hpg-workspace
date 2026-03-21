

# Assessment: Financial Hub Readiness

## Current State — What's Real vs. Placeholder

The Financial Hub pages are **genuinely functional**, not placeholders. Here's what works today:

### Fully Operational (data entry + live queries)
- **Journal Entry Workspace** — real batch entry form with account selector, debit/credit balancing, period-lock enforcement, posts to `transactions` + `journal_entries`
- **Invoices (AR)** — create invoices, mark sent, record payment (auto-generates balanced journal entries: DR Cash / CR AR)
- **Bills (AP)** — enter vendor bills (auto-posts DR Expense / CR AP), record payments
- **Trial Balance Worksheet** — aggregates journal entries by account with beginning/ending balances, CSV export
- **Profit & Loss** — reads real journal data, groups by income_statement_section, supports period comparison
- **Balance Sheet** — reads real ledger balances, calculates 5 financial ratios
- **Cash Flow Statement** — maps accounts by cash_flow_section
- **Bank Reconciliation** — create reconciliations, add line items (deposits in transit, outstanding checks, etc.)
- **Chart of Accounts** — create/edit accounts with code, name, type
- **Aging Reports** — AR and AP aging buckets with CSV export

### What's Missing to Make It Production-Ready

1. **No PDF export** — reports only render in-browser. No PDF generation for P&L, Balance Sheet, Trial Balance, invoices, or journal entries. The only "print" capability is the SavedLedgersSection `window.print()` hack.

2. **No "Save to Documents" flow** — financial reports can't be saved as documents into the NGO document system. The `SavedLedgerDocument` system exists for transaction snapshots, but statements (P&L, Balance Sheet, etc.) have no save/export-to-documents button.

3. **Chart of Accounts editor lacks the extended fields** — the `AccountsTable` create/edit form only sets `code`, `name`, `type`. It doesn't expose `normal_balance`, `balance_sheet_section`, `income_statement_section`, `cash_flow_section`, `is_contra_account` — the fields that drive the P&L and Balance Sheet groupings. Without setting these, statements show $0 everywhere.

4. **No CSV/bank import** on the Reconciliation page.

5. **No Opening Balances entry UI** — the hook exists but there's no page to enter opening balances.

6. **Recurring Transactions** — the page exists but there's no auto-execution logic; it's just a list.

---

## Plan: Make Accounting Truly Usable End-to-End

### Step 1: Fix the Chart of Accounts Editor
Extend `AccountsTable` create/edit dialog to include:
- `normal_balance` (debit/credit)
- `financial_statement_type` (balance_sheet / income_statement / cash_flow_support)
- `balance_sheet_section`, `income_statement_section`, `cash_flow_section`
- `is_contra_account`

This is the **critical blocker** — without these fields, P&L and Balance Sheet always show zeros.

### Step 2: Opening Balances Entry UI
Add an Opening Balances tab or page where users can set per-account beginning balances for a fiscal period. Use the existing `useOpeningBalances` hook.

### Step 3: PDF Export for Financial Reports
Add a "Download PDF" button to:
- P&L, Balance Sheet, Cash Flow Statement, Trial Balance
- Individual journal entries / transaction detail
- Invoices and Bills

Use client-side HTML-to-print with `window.print()` styled for PDF (no external library needed — browser print-to-PDF is reliable and avoids adding dependencies).

### Step 4: Save Report Snapshots to Documents
Add "Save to Documents" button on each financial statement page that:
- Renders the current report as HTML
- Saves it to `saved_ledger_documents` (already exists)
- Optionally uploads a PDF blob to `ngo-documents` storage bucket

### Step 5: Bank CSV Import
Add CSV upload on the Reconciliation page that parses date/description/amount columns and creates reconciliation items or unmatched transactions.

### Technical Details

**Files to create:**
- `src/pages/OpeningBalancesPage.tsx` — opening balance entry grid
- `src/utils/financialPdfExport.ts` — shared print/PDF utility

**Files to modify:**
- `src/components/finance/AccountsTable.tsx` — extend create/edit form with classification fields
- `src/hooks/useAccounts.ts` — ensure create/update mutations pass extended fields
- `src/pages/ProfitAndLoss.tsx` — add Print/Save buttons
- `src/pages/BalanceSheetPage.tsx` — add Print/Save buttons
- `src/pages/TrialBalanceWorksheet.tsx` — add Print button
- `src/pages/CashFlowStatement.tsx` — add Print/Save buttons
- `src/pages/InvoicesPage.tsx` — add Print invoice button
- `src/pages/BankReconciliationPage.tsx` — add CSV import
- `src/App.tsx` — add Opening Balances route
- `src/components/layout/AppSidebar.tsx` — add Opening Balances nav item

**No database changes needed** — all tables and columns already exist.

