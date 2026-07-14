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
];

for (const [source, contract] of accountingContracts) {
  assert.ok(source.includes(contract), `Missing accounting contract: ${contract}`);
}

assert.match(app, /path="\/financial-hub\/operations"/);
assert.ok(hub.includes("Finance Operations"), "Finance Hub must expose the operational queue");
assert.ok(operations.includes("Approval queue"), "Operations page must contain a unified approval queue");
assert.ok(operations.includes("Notification outbox"), "Operations page must expose notification delivery state");
assert.ok(purchaseHook.includes('rpc("review_purchase_request"'), "Purchase approvals must use the authority-checked RPC");
assert.ok(budgetHook.includes('rpc("save_finance_budget"'), "Budget saves must be atomic");
assert.ok(budgetHook.includes('rpc("review_finance_budget"'), "Budget approvals must use the authority-checked RPC");
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
console.log("  NGO ledger · atomic expenses · receipt AI · bank reconciliation · hard close · 10 audited reports");
