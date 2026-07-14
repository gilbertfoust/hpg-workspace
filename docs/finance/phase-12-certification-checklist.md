# Finance Hub Certification Checklist

## Engineering certification — complete

- [x] Production build, TypeScript, scoped ESLint, and static Finance contracts pass
- [x] Forward Finance migrations applied to the connected HPG project
- [x] Anonymous execution revoked for protected Finance RPCs
- [x] NGO selector uses the canonical NGO directory across the workspace
- [x] Ordinary journals and their lines enforce one NGO
- [x] Balanced journal posts; unbalanced journal is rejected
- [x] Posted entries cannot be silently edited
- [x] Locked month rejects posting even when its quarter/year rollup is open
- [x] Atomic expense commits payment, journal, and receipt evidence together
- [x] Receipt hash duplicate detection, extraction draft, review, and posting tested
- [x] Cross-NGO bank match rejected
- [x] Statement transactions tie to beginning/ending balances
- [x] Reconciliation requires every statement row resolved and zero difference
- [x] Finalized reconciliation and statement evidence are immutable
- [x] Unbalanced opening-balance CSV rejected
- [x] Balanced opening balances retain source CSV and post as one journal
- [x] Period close rejects drafts, missing evidence, unresolved receipts/statements, unreconciled accounts, open prerequisite months, and staged balances
- [x] Period close stores its readiness snapshot and lock blocks posting
- [x] Year end requires every month closed
- [x] Year-end finalization locks all rollups and an immutable reporting package
- [x] Fiscal-year and period reopen require a reason and preserve the prior package
- [x] Ten report screens support audited CSV output
- [x] Statement of Financial Position renders and exports assets, liabilities, and net assets
- [x] Statement of Cash Flows classifies actual cash movements and ties beginning to ending cash without double-counting AP accruals
- [x] Official reports support audited print / Save-as-PDF output
- [x] Year-end packages support audited JSON download
- [x] New Finance close/import/year-end tables have RLS and no advisor warning/error

## Automated evidence

Run before each release:

```bash
npm run verify:finance
```

Run against staging/production inside rollback transactions:

1. `scripts/finance/test_atomic_posting.sql`
2. `scripts/finance/test_bank_statement_reconciliation.sql`
3. `scripts/finance/test_close_and_year_end.sql`

The bank reconciliation and close/year-end suites passed against the connected HPG project on July 14, 2026. The suites create representative records, assert rejection cases, and roll back all data.

## Accountant go-live sign-off — required per NGO

These are operating approvals, not unfinished software development:

- [ ] Legal entity/profile and fiscal year confirmed
- [ ] Chart of accounts and nonprofit statement mappings approved by the accountant
- [ ] Prior-system cutover date selected
- [ ] Opening trial balance imported, compared, and approved
- [ ] Bank/card balances reconciled through the cutover date
- [ ] Restricted fund and grant balances compared to source schedules
- [ ] AP and AR aging compared to source schedules
- [ ] One parallel month-end close completed and reports compared
- [ ] User roles, MFA, and Finance-manager access reviewed
- [ ] Notification route and dispatcher verified if Slack/email delivery is enabled
- [ ] Accountant signs authorization to make HPG Finance the system of record

## First live accounting scenarios

1. Unrestricted donation receipt and deposit
2. Donor-restricted donation for a sponsored NGO
3. Fiscal-sponsorship admin fee
4. Vendor bill approval and payment
5. Employee/contractor expense receipt upload and posting
6. Grant receivable invoice and payment
7. Restricted-fund release entry
8. Bank and credit-card reconciliation
9. Month close and locked-period rejection
10. Year-end package generation and print/PDF comparison
