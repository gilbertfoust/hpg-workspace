# Finance Hub Production Readiness

**Accounting MVP status:** 100% implemented and deployed to the connected HPG Supabase project

**Repository gate:** `npm run verify:finance`

**Transactional database gates:**

- `scripts/finance/test_atomic_posting.sql`
- `scripts/finance/test_bank_statement_reconciliation.sql`
- `scripts/finance/test_close_and_year_end.sql`

## What “100%” means

HPG can operate its NGO bookkeeping and nonprofit financial reporting from this workspace without buying QuickBooks for the core general-ledger workflow. The live system now covers:

- workspace-wide NGO selection sourced from the canonical NGO directory;
- one authoritative, NGO-scoped double-entry ledger;
- atomic expenses, payments, bills, deposits, journals, reversals, and voids;
- receipt upload, SHA-256 duplicate detection, AI/OCR draft extraction, account suggestions, human review, and atomic posting;
- bank, cash, and credit-card registers;
- CSV statement import, automatic same-NGO ledger matching, evidence-backed reconciliation, and zero-difference finalization;
- balanced opening-balance CSV migration whose source file is retained and whose rows become a posted journal;
- monthly posting authority, hard period-close readiness, locking, and reasoned reopen controls;
- immutable year-end packages and audited year reopen/revision history;
- trial balance, general ledger, Statement of Activities, Statement of Financial Position, Statement of Cash Flows, functional expenses, restricted funds, budget vs. actual, AP/AR aging, deposits, and missing-receipt reporting;
- audited CSV, JSON, print, and Save-as-PDF output paths;
- role-checked operational approvals, work items, and notification outbox records.

This status does not mean the application is a payroll processor, tax/1099 e-filing service, ACH originator, or direct bank-data aggregator. Those are external services rather than ledger requirements. Bank/card data enters through institution CSV exports in this release. A CPA should approve HPG’s chart-of-accounts mappings, opening balances, fiscal policies, and filed statements before the first production close.

## Accounting guarantees

1. Ordinary journals belong to exactly one selected NGO.
2. Every posted journal has at least two lines and equal debits and credits.
3. A posting resolves to an open **monthly** period; an open quarter or year cannot bypass a locked month.
4. Posted activity is immutable; corrections use voids or reversing entries.
5. Expense posting, payment state, journal lines, and receipt evidence commit in one database transaction.
6. Receipt extraction never posts autonomously; Finance confirms the draft and accounts.
7. Bank matches cannot cross NGOs, finalized reconciliations require zero difference, and finalized evidence is locked.
8. A period cannot close with an unbalanced trial balance, draft journals, unresolved receipts, missing expense evidence, unreconciled bank/card accounts, unresolved statements, open prerequisite months, or unposted opening balances.
9. Opening balances require a balanced CSV, retained source evidence, and one posted journal.
10. Finalizing a fiscal year requires all months closed, locks all period rollups, and locks the generated package. Reopening preserves the old package and requires a reason.
11. The Statement of Cash Flows classifies actual cash movements and must tie beginning cash plus net change to ending cash; non-cash AP accruals are not double-counted.

## Release and verification evidence

The connected production schema was migrated incrementally and tested inside rollback-only transactions on July 14, 2026. Tests confirmed:

- same-NGO posting and cross-NGO rejection;
- balanced atomic expense and receipt posting;
- receipt duplicate detection and review-before-post;
- bank statement tie-out, matching, reconciliation, and immutable finalization;
- unbalanced opening import rejection;
- opening balances posted to the live ledger with source evidence;
- draft-journal and unposted-opening-balance close blockers;
- locked-month posting rejection, including the overlapping-quarter bypass test;
- sequential monthly close, year-end finalization, locked package creation, and controlled reopen.

The production security/performance advisor reports no error or warning for the new close, opening-balance, year-end, receipt-draft, statement-import, or reconciliation tables after hardening. Security-definer RPC notices are intentional: every exposed mutation performs its own signed-in role check and anonymous execution is revoked.

## Go-live procedure

1. Confirm each NGO profile and fiscal calendar.
2. Have the accountant approve the chart of accounts and nonprofit classifications.
3. Export the cutover trial balance from the prior system using the opening-balance CSV template.
4. Import, review, and post the balanced opening journal for each NGO.
5. Add every bank/card account and import the first statement.
6. Reconcile through the cutover date.
7. Run all three transactional database gates and `npm run verify:finance`.
8. Complete one accountant-led parallel close, compare every statement, and sign the certification checklist.
9. Make HPG Finance the system of record and retain the prior-system archive read-only.

## External operating dependencies

- The receipt extraction Edge Function and its AI gateway secret must remain active.
- The Finance notification dispatcher must drain `finance_workflow_events` if Slack/email delivery is desired.
- Institution statement CSVs must be downloaded and uploaded until a bank-data provider is added.
- Backups, user offboarding, MFA, and periodic access reviews remain workspace operations responsibilities.
