import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const read = (path) => readFileSync(resolve(root, path), "utf8");

const migration = read("supabase/migrations/20260713204701_finance_hub_production_completion.sql");
const app = read("src/App.tsx");
const hub = read("src/pages/FinancialHub.tsx");
const operations = read("src/pages/FinanceOperationsPage.tsx");
const reports = read("src/pages/FinanceReportsPage.tsx");
const purchaseHook = read("src/hooks/usePurchaseRequests.ts");
const budgetHook = read("src/hooks/useFinanceBudgets.ts");

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

assert.match(app, /path="\/financial-hub\/operations"/);
assert.ok(hub.includes("Finance Operations"), "Finance Hub must expose the operational queue");
assert.ok(operations.includes("Approval queue"), "Operations page must contain a unified approval queue");
assert.ok(operations.includes("Notification outbox"), "Operations page must expose notification delivery state");
assert.ok(purchaseHook.includes('rpc("review_purchase_request"'), "Purchase approvals must use the authority-checked RPC");
assert.ok(budgetHook.includes('rpc("save_finance_budget"'), "Budget saves must be atomic");
assert.ok(budgetHook.includes('rpc("review_finance_budget"'), "Budget approvals must use the authority-checked RPC");

const reportCards = reports.match(/<ReportCard title=/g) ?? [];
const auditedExports = reports.match(/exportWithAudit\(/g) ?? [];
assert.equal(reportCards.length, 10, "Finance Reports should expose ten report cards");
assert.equal(auditedExports.length, 10, "Every report card must use the audited export flow");
assert.equal((reports.match(/exportToCsv\(/g) ?? []).length, 1, "CSV downloads must only occur inside exportWithAudit");

console.log("Finance Hub static contracts: PASS");
console.log("  3 workflow types · 10 report exports · RLS + RPC authority checks");
