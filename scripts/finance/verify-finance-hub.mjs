import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const read = (path) => readFileSync(resolve(root, path), "utf8");

const migration = read("supabase/migrations/20260713204701_finance_hub_production_completion.sql");
const entityMigration = read("supabase/migrations/20260714093542_finance_entity_ledger_authority.sql");
const expenseMigration = read("supabase/migrations/20260714100203_finance_atomic_expense_transactions.sql");
const receiptMigration = read("supabase/migrations/20260714104500_finance_receipt_intelligence.sql");
const bankMigration = read("supabase/migrations/20260714111500_finance_bank_statement_reconciliation.sql");
const closeMigration = read("supabase/migrations/20260714121500_finance_close_migration_and_year_end.sql");
const monthlyAuthorityMigration = read("supabase/migrations/20260714122500_finance_monthly_posting_period_authority.sql");
const openingEvidenceMigration = read("supabase/migrations/20260714123500_finance_opening_balance_source_evidence.sql");
const cashFlowMigration = read("supabase/migrations/20260714125500_finance_cash_flow_tie_out.sql");
const nonprofitStatementsMigration = read("supabase/migrations/20260714130500_finance_nonprofit_statement_rollforward.sql");
const receiptResolutionMigration = read("supabase/migrations/20260714131500_finance_receipt_draft_resolution.sql");
const ngoAccountMigration = read("supabase/migrations/20260714132500_finance_ngo_account_ecosystem.sql");
const arMigration = read("supabase/migrations/20260714133500_finance_ar_atomic_ledger.sql");
const integrityMigration = read("supabase/migrations/20260714134500_finance_integrity_graph.sql");
const automationMigration = read("supabase/migrations/20260714135500_finance_recurring_and_integration_foundation.sql");
const goLiveMigration = read("supabase/migrations/20260714141500_finance_go_live_certification.sql");
const goLiveGuardMigration = read("supabase/migrations/20260714142500_finance_go_live_current_comparison_guard.sql");
const goLiveHardeningMigration = read("supabase/migrations/20260714143500_finance_go_live_advisor_hardening.sql");
const app = read("src/App.tsx");
const hub = read("src/pages/FinancialHub.tsx");
const operations = read("src/pages/FinanceOperationsPage.tsx");
const reports = read("src/pages/FinanceReportsPage.tsx");
const purchaseHook = read("src/hooks/usePurchaseRequests.ts");
const budgetHook = read("src/hooks/useFinanceBudgets.ts");
const transactionPage = read("src/pages/FinanceTransactionsPage.tsx");
const transactionHook = read("src/hooks/useFinanceTransactions.ts");
const reconciliationPage = read("src/pages/FinanceReconciliationPage.tsx");
const fiscalPeriodsPage = read("src/pages/FinanceFiscalPeriodsPage.tsx");
const openingBalancesPage = read("src/pages/FinanceOpeningBalancesPage.tsx");
const compliancePage = read("src/pages/FinanceCompliancePage.tsx");
const budgetPage = read("src/pages/FinanceBudgetsPage.tsx");
const receivablesPage = read("src/pages/FinanceAccountsReceivablePage.tsx");
const invoiceHook = read("src/hooks/useFinanceInvoices.ts");
const automationPage = read("src/pages/FinanceAutomationPage.tsx");
const goLivePage = read("src/pages/FinanceGoLivePage.tsx");
const goLiveHook = read("src/hooks/useFinanceGoLive.ts");

const requiredMigrationContracts = [
  "CREATE TABLE IF NOT EXISTS public.finance_expense_requests",
  "CREATE TABLE IF NOT EXISTS public.finance_workflow_events",
  "CREATE OR REPLACE FUNCTION public.get_finance_access_capabilities",
  "CREATE OR REPLACE FUNCTION public.save_finance_expense_request",
  "CREATE OR REPLACE FUNCTION public.submit_finance_expense_request",
  "CREATE OR REPLACE FUNCTION public.review_finance_expense_request",
  "CREATE OR REPLACE FUNCTION public.mark_finance_expense_request_paid",
  "CREATE OR REPLACE FUNCTION public.save_purchase_request",
  "CREATE OR REPLACE FUNCTION public.submit_purchase_request",
  "CREATE OR REPLACE FUNCTION public.review_purchase_request",
  "CREATE OR REPLACE FUNCTION public.save_finance_budget",
  "CREATE OR REPLACE FUNCTION public.submit_finance_budget",
  "CREATE OR REPLACE FUNCTION public.review_finance_budget",
  "ALTER TABLE public.finance_expense_requests ENABLE ROW LEVEL SECURITY",
  "ALTER TABLE public.finance_workflow_events ENABLE ROW LEVEL SECURITY",
  "REVOKE INSERT, UPDATE, DELETE ON public.purchase_requests FROM authenticated",
  "REVOKE ALL ON FUNCTION %s FROM PUBLIC",
  "lower(trim(ou.department_name)) = 'finance'",
];

for (const contract of requiredMigrationContracts) {
  assert.ok(migration.includes(contract), `Missing migration contract: ${contract}`);
}

const accountingContracts = [
  [entityMigration, "finance_validate_journal_entity_scope"],
  [expenseMigration, "create_and_post_finance_expense_transaction"],
  [receiptMigration, "post_finance_receipt_draft"],
  [bankMigration, "import_finance_bank_statement"],
  [bankMigration, "finalize_finance_bank_reconciliation"],
  [closeMigration, "finance_period_close_readiness"],
  [closeMigration, "finalize_finance_year_end"],
  [monthlyAuthorityMigration, "period.period_type = 'month'"],
  [openingEvidenceMigration, "import_finance_opening_balances_with_source"],
  [openingEvidenceMigration, "Source CSV for posted opening balances"],
  [cashFlowMigration, "cash_flow_ties"],
  [cashFlowMigration, "finance_opening_balance"],
  [nonprofitStatementsMigration, "statement_is_balanced"],
  [nonprofitStatementsMigration, "pass_through_expenses"],
  [receiptResolutionMigration, "dismiss_finance_receipt_draft"],
  [receiptResolutionMigration, "Receipt draft dismissed"],
  [ngoAccountMigration, "CREATE TABLE public.finance_ngo_accounts"],
  [ngoAccountMigration, "ensure_finance_ngo_account"],
  [ngoAccountMigration, "finance_ngo_account_catalog"],
  [arMigration, "issue_finance_invoice"],
  [arMigration, "record_finance_invoice_payment"],
  [arMigration, "write_off_finance_invoice"],
  [arMigration, "void_finance_invoice"],
  [integrityMigration, "settle_finance_expense_request"],
  [integrityMigration, "finance_accounting_integrity"],
  [integrityMigration, "Every completed economic form is linked to posted journal activity"],
  [integrityMigration, "ecosystem_integrity"],
  [automationMigration, "generate_due_finance_recurring_drafts"],
  [automationMigration, "finance_integration_outbox"],
  [automationMigration, "queue_finance_payment_intent"],
  [goLiveMigration, "finance_parallel_close_comparisons"],
  [goLiveMigration, "finance_cutover_system_metrics"],
  [goLiveMigration, "approve_finance_parallel_close"],
  [goLiveMigration, "finance_go_live_readiness"],
  [goLiveMigration, "activate_finance_system_of_record"],
  [goLiveMigration, "Every active bank is reconciled through cutover"],
  [goLiveGuardMigration, "finance_parallel_close_is_current"],
  [goLiveGuardMigration, "Approved comparison is missing or stale; run it again"],
  [goLiveGuardMigration, "finance_go_live_readiness_without_current_comparison"],
  [goLiveHardeningMigration, "idx_fin_go_live_parallel_close"],
  [goLiveHardeningMigration, "FROM PUBLIC, anon, authenticated"],
];

for (const [source, contract] of accountingContracts) {
  assert.ok(source.includes(contract), `Missing accounting contract: ${contract}`);
}

assert.match(app, /path="\/financial-hub\/operations"/);
assert.match(app, /path="\/financial-hub\/accounting\/automation"/);
assert.match(app, /path="\/financial-hub\/accounting\/go-live"/);
assert.ok(hub.includes("Finance Operations"), "Finance Hub must expose the operational queue");
assert.ok(hub.includes("Living accounting ecosystem"), "Finance Hub must expose parent/child accounting integrity");
assert.ok(operations.includes("Approval queue"), "Operations page must contain a unified approval queue");
assert.ok(operations.includes("Notification outbox"), "Operations page must expose notification delivery state");
assert.ok(purchaseHook.includes('rpc("review_purchase_request"'), "Purchase approvals must use the authority-checked RPC");
assert.ok(budgetHook.includes('rpc("save_finance_budget"'), "Budget saves must be atomic");
assert.ok(budgetHook.includes('rpc("review_finance_budget"'), "Budget approvals must use the authority-checked RPC");
assert.ok(budgetPage.includes("Create account from budget"), "Budget entry must be able to create and activate NGO accounts");
assert.ok(operations.includes("useSettleFinanceExpenseRequest"), "Expense settlement must select an actual posted payment");
assert.ok(invoiceHook.includes('rpc("issue_finance_invoice"'), "AR issuance must post through the atomic ledger RPC");
assert.ok(invoiceHook.includes('rpc("record_finance_invoice_payment"'), "AR receipts must post through the atomic ledger RPC");
assert.ok(receivablesPage.includes("Issue & post"), "AR must expose ledger-backed invoice issuance");
assert.ok(automationPage.includes("Recurring journal rules"), "Finance automation must expose reviewable recurring drafts");
assert.ok(automationPage.includes("Integration outbox"), "Finance automation must expose durable provider delivery state");
assert.ok(goLivePage.includes("Parallel close comparison"), "Go-live must compare prior-system and HPG totals");
assert.ok(goLivePage.includes("Activate system of record"), "Go-live must expose the guarded activation action");
assert.ok(goLiveHook.includes('rpc("activate_finance_system_of_record"'), "System-of-record activation must use the guarded RPC");
assert.ok(transactionPage.includes("receipt"), "Transaction entry must expose receipt evidence");
assert.ok(transactionPage.includes("handleDismissReceipt"), "Receipt inbox must resolve unreadable drafts");
assert.ok(transactionHook.includes('rpc("dismiss_finance_receipt_draft"'), "Receipt dismissal must use the audited RPC");
assert.ok(reconciliationPage.includes("Statement"), "Reconciliation must expose bank statement imports");
assert.ok(fiscalPeriodsPage.includes("Close readiness"), "Fiscal periods must expose hard close readiness");
assert.ok(openingBalancesPage.includes("Post balanced opening journal"), "Opening balances must post into the ledger");
assert.ok(compliancePage.includes("Finalize & lock year"), "Compliance must expose year-end finalization");
assert.ok(reports.includes("Total liabilities and net assets"), "Statement of Financial Position must render complete totals");
assert.ok(reports.includes("Cash flow ties to the change in cash"), "Statement of Cash Flows must expose its tie-out");

const reportCards = reports.match(/<ReportCard title=/g) ?? [];
const auditedExports = reports.match(/exportWithAudit\(/g) ?? [];
assert.equal(reportCards.length, 10, "Finance Reports should expose ten report cards");
assert.equal(auditedExports.length, 10, "Every report card must use the audited export flow");
assert.equal((reports.match(/exportToCsv\(/g) ?? []).length, 1, "CSV downloads must only occur inside exportWithAudit");

console.log("Finance Hub static contracts: PASS");
console.log("  NGO account ecosystem · atomic AP/AR · receipt AI · integrity graph · certified cutover · hard close · 10 audited reports");
