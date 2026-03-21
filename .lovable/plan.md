

# Fill QuickBooks Feature Gaps in Financial Hub

## What's Missing (prioritized by impact)

### 1. Invoicing & Accounts Receivable
- **New tables**: `invoices` (invoice_number, customer_name, due_date, status: draft/sent/paid/overdue, total, ngo_id, fiscal_period_id), `invoice_line_items` (invoice_id, description, quantity, unit_price, account_id, amount)
- **New page**: `/financial-hub/invoices` — list, create, mark paid
- **New page**: `/financial-hub/reports/aged-receivables` — 0-30, 31-60, 61-90, 90+ day buckets
- Posting an invoice auto-creates a journal entry (DR Accounts Receivable, CR Revenue)
- Recording payment auto-creates journal entry (DR Cash, CR Accounts Receivable)

### 2. Bills & Accounts Payable
- **New tables**: `bills` (vendor_name, bill_number, due_date, status: pending/paid/overdue, total, ngo_id), `bill_line_items` (bill_id, description, amount, account_id)
- **New page**: `/financial-hub/bills` — enter bills, record payments
- **New page**: `/financial-hub/reports/aged-payables` — aging buckets
- Entering a bill: DR Expense/Asset, CR Accounts Payable
- Paying a bill: DR Accounts Payable, CR Cash

### 3. Recurring Transactions
- **New table**: `recurring_transactions` (ngo_id, template_name, frequency: weekly/monthly/quarterly, next_run_date, transaction_template JSONB, is_active)
- UI to define and manage recurring entries on the Journal page
- Edge function or client-side logic to auto-post when due

### 4. Bank Transaction Import
- CSV upload component on the Reconciliation page
- Parse and match imported rows against existing transactions
- Create unmatched items as new journal entries or reconciliation items

### 5. Receipt/Document Attachment on Transactions
- **New table**: `transaction_attachments` (transaction_id FK, document_id FK → documents)
- Upload button on journal entry and transaction views
- Links to existing document storage system

### 6. Financial Report Export
- Add PDF/CSV export buttons to P&L, Balance Sheet, Cash Flow, Trial Balance, and aging reports
- Use client-side generation (jsPDF + autoTable for PDF, native CSV)

### 7. Sales Tax Tracking
- **New table**: `tax_rates` (name, rate, is_default, ngo_id)
- Apply tax on invoice line items
- **New page**: `/financial-hub/reports/tax-liability` — summarize collected vs owed

### 8. Navigation Updates
Add to Financial Hub sidebar group:
- Invoices, Bills, Recurring Transactions
- Under Reports sub-group: Aged Receivables, Aged Payables, Tax Liability

## Technical approach
- All new tables get RLS policies matching existing pattern (authenticated users)
- Invoice/bill posting reuses existing `transactions` + `journal_entries` tables — no duplicate ledger
- New hooks: `useInvoices`, `useBills`, `useRecurringTransactions`, `useTaxRates`
- ~12 new files (pages + hooks), 1 migration, sidebar update

## Priority order for implementation
1. Invoices + AR + Aged Receivables (highest user value)
2. Bills + AP + Aged Payables
3. Report export (PDF/CSV)
4. Recurring transactions
5. Receipt attachments
6. Bank import
7. Sales tax

