# Finance Hub / QuickBooks-Style Accounting — Implementation Map

**Branch:** `dashboard-local-buildout`  
**Bundle:** Phases 31–45  
**Principle:** Build HPG-internal double-entry ledger in new `finance_*` tables. Legacy `accounts` / `transactions` / `journal_entries` remain for per-NGO ledger experiments; new buildout does not depend on QuickBooks API.

## Existing assets (inspected)

| Area | Location | Notes |
|------|----------|-------|
| Legacy COA / ledger | `accounts`, `transactions`, `journal_entries`, `receipts`, `reconciliations` | NGO-scoped; income vs revenue naming |
| Finance Hub UI | `src/pages/FinancialHub.tsx`, `/financial-hub/*` routes | Reporting, COA, transactions, GL, trial balance |
| Documents | `documents` | Attachments for evidence |
| Work items | `work_items` | Routing, finance inbox |
| NGOs | `ngos` | Fiscal sponsorship entities |
| Departments | `org_units` | Department dimension |
| Grants | `grant_opportunities`, `grant_applications` | Fund/grant linkage |
| Access | `src/lib/accessControl.ts` | `vp_finance`, admin roles, finance area |
| Admin records | `work_item_admin_records` | Completed work archive |

## New schema namespace (`finance_*`)

Phases 31–45 add organization-wide accounting tables separate from legacy ledger.

| Phase | Tables / RPCs | UI / integration |
|-------|---------------|------------------|
| 31 | `finance_accounts`, `finance_funds`, `finance_dimensions`, `finance_journal_entries`, `finance_journal_lines`, `finance_audit_events`; post/void/reverse RPCs | Types only |
| 32 | — | Chart of Accounts UI |
| 33 | — | Journal Entries UI |
| 34 | `finance_bank_accounts` | Bank accounts UI |
| 35 | `finance_document_links` (or receipt links) | Receipt attachment workflow |
| 36 | `finance_vendors`, `finance_bills`, `finance_bill_lines`, `finance_bill_payments` | AP / Bills |
| 37 | `finance_payments` | Payments / disbursements |
| 38 | `finance_deposits`, `finance_deposit_lines` | Deposits / revenue |
| 39 | `finance_admin_fee_rules` | Fiscal sponsorship admin fees |
| 40 | `finance_bank_reconciliations`, `finance_bank_reconciliation_items` | Bank reconciliation |
| 41 | `finance_budgets`, `finance_budget_lines` | Budgets |
| 42 | — | Financial reports (read posted data) |
| 43 | — | Dashboard + Finance Hub integration |
| 44 | RLS refinements | Permission guards |
| 45 | — | Hardening + docs |

## Accounting rules (enforced in DB)

1. Posted journal entries: debits = credits, ≥ 2 lines.
2. Posted entries/lines are immutable; void/reverse only via RPC.
3. Funds carry restriction type for nonprofit reporting.
4. Lines tie to NGO, fund, department, document, grant, work item as optional dimensions.
5. All mutations log to `finance_audit_events` where practical.

## Permission model (Phase 31 baseline → Phase 44 refine)

- **Manage:** `super_admin`, `admin_pm`, `vp_finance`
- **Read (internal):** internal staff (department scoping in Phase 44)
- **No access:** NGO portal roles

## Deployment

- Migrations written locally; `supabase db push` only when explicitly instructed.
- No QuickBooks / Plaid integration in this bundle.
