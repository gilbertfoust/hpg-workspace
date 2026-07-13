# Finance Hub — Phases 0–12 Certification Checklist

Use this checklist after `npx supabase db push` against the linked HPG project.

## Readiness summary

- [x] Implementation complete for Phases 0–12 and Finance Operations
- [x] `npm run verify:finance` passes (build, typecheck, scoped lint, static contracts)
- [x] Expense, purchase, and budget workflows use authority-checked RPCs
- [x] Workflow submissions create work items and durable notification events
- [x] Finance staff authority is scoped to the Finance department
- [x] All ten Finance CSV exports are audit-logged before download
- [ ] Forward migration applied to the linked project
- [ ] Post-deployment SQL and role-based checks below completed

Repository implementation is 100% complete. The unchecked items are deployment certification steps and must not be represented as passed until they run against the target database.

## Phase 1 — Atomic posting
- [ ] Balanced legacy transaction posts via `post_transaction` RPC
- [ ] Unbalanced legacy transaction rejected
- [ ] Locked NGO fiscal period rejects legacy post
- [ ] Finance draft saves atomically via `save_finance_journal_entry`
- [ ] Finance post validates open `finance_fiscal_period`

## Phase 2 — Chart of accounts
- [ ] COA account supports restriction, functional, 990, and statement mapping fields
- [ ] Cash account flag drives cash flow statement

## Phase 3 — Fiscal periods
- [ ] Finance fiscal periods can be closed, locked, reopened (manager only)
- [ ] Opening balances can be entered for open periods
- [ ] Posting blocked in locked/closed periods

## Phase 4 — Ledger & trial balance
- [ ] Trial balance validation RPC returns `is_balanced: true` on empty ledger
- [ ] General ledger shows running balance per account
- [ ] Report snapshots can be saved

## Phase 5 — Nonprofit statements
- [ ] Statement of Financial Position separates restricted/unrestricted net assets
- [ ] Statement of Activities shows functional expense buckets
- [ ] Statement of Cash Flows ties beginning/ending cash

## Phase 6 — Bank reconciliation
- [ ] Reconciliation refresh calculates book balance and difference
- [ ] Finalize requires zero difference or exception notes

## Phase 7 — AR
- [ ] Donors and invoices can be created
- [ ] Partial payments update invoice status
- [ ] AR aging report lists open balances

## Phase 8 — Fiscal sponsorship
- [ ] Pass-through requests can be approved with admin fee
- [ ] NGO subledger balance RPC returns fund splits

## Phase 9 — Controls
- [ ] Finance staff can save drafts (RLS)
- [ ] Export actions logged in `finance_export_log`
- [ ] Posted entries cannot be silently edited

## Phase 10 — Budget & grants
- [ ] Budget vs actual report returns variances by account
- [ ] Grant financial report returns received/spent/remaining

## Phase 11 — Compliance
- [ ] Functional expense report exports for Form 990 support
- [ ] Year-end package generates trial balance + statements bundle

## Phase 12 — Production certification
- [x] `npm run build` passes
- [x] `npx tsc --noEmit` passes
- [x] `npm run lint:finance` passes
- [x] `node scripts/finance/verify-finance-hub.mjs` passes
- [ ] `scripts/finance/test_atomic_posting.sql` validation queries pass
- [ ] `scripts/finance/test_operational_workflows.sql` validation queries pass
- [ ] Finance staff can complete workflow without developer intervention
- [ ] No fake production financial data (demo seeds only when tables empty)

## Finance Operations (post-deployment)

- [ ] Internal requestor can save and submit an expense request
- [ ] Expense submission creates a Finance work item and Slack/email outbox event
- [ ] Non-Finance staff cannot prepare a budget or review an approval
- [ ] Finance staff can atomically save and submit a budget
- [ ] Finance manager can approve/reject expense, purchase, and budget requests
- [ ] Approved expense can be marked paid only with a payment reference
- [ ] Direct Data API status updates are denied
- [ ] Anonymous role cannot execute protected Finance RPCs
- [ ] Notification dispatcher marks queued events sent or failed

## Accounting scenarios (manual QA)
1. Unrestricted donation receipt and post
2. Donor-restricted donation for sponsored NGO
3. Admin fee calculation on deposit
4. Pass-through disbursement approval
5. Vendor bill approve and pay
6. Grant receivable invoice and payment
7. Restricted fund release entry
8. Bank reconciliation finalize
9. Fiscal period lock blocks new posts
10. Year-end package export
