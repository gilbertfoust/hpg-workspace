# NGO finance platform readiness

The HPG workspace now has the application and database foundation for NGO-isolated accounting, quarterly submission, onboarding, international bank connectivity, controlled funding, Form 990 preparation, analysis, grant collaboration, and advanced accounting.

## Live accounting path

1. An administrator or authorized IT manager creates an NGO portal user and assigns one or more NGO memberships.
2. The NGO signs its issued agreement, pays the onboarding fee, and connects a supported financial account.
3. NGO preparers record receipt-backed transactions against approved accounts. Posting creates balanced journal lines in the NGO ledger and honors fiscal-period locks.
4. New chart-of-account requests remain unusable until Finance approves them.
5. The NGO prepares and submits a quarter. Readiness checks block submission for unbalanced entries, drafts, missing receipts, pending accounts, or other integrity failures.
6. Finance reviews and approves the quarter. Approved periods are locked from ordinary NGO edits.
7. Statements, reports, analysis, recommendations, Form 990 workpapers, and proposal contributions read from the same posted ledger.

## International funding controls

- Plaid is a bank-data connection where the requested country and product are supported. It is not treated as a universal international payout rail.
- Stripe Connect and Wise are payout adapters. Provider eligibility, destination country, currency, compliance, and account capability are checked before a disbursement can be queued.
- Relay is represented as a controlled manual rail until HPG has a documented provider API for its account. A verified final receipt is mandatory.
- Funding requires a verified destination, dual Finance approvals, immutable status events, a provider or manual receipt, and a balanced journal entry before it can become `paid`.
- Provider credentials are encrypted or held in Edge Function secrets. Browser clients cannot read the credential-reference table.

## Production configuration gates

Configure these Edge Function secrets before enabling the corresponding provider:

- Stripe: `STRIPE_SECRET_KEY`, `STRIPE_ONBOARDING_WEBHOOK_SECRET`, `PUBLIC_SITE_URL`, and optionally `DEFAULT_NGO_ONBOARDING_FEE_CENTS`.
- Plaid: `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV`, `PLAID_WEBHOOK_URL`, and a base64-encoded 32-byte `BANK_TOKEN_ENCRYPTION_KEY`.
- Wise: `WISE_API_TOKEN`, `WISE_PROFILE_ID`, and optionally `WISE_API_BASE_URL`.

Provider sandbox tests, webhook replay tests, destination-country test payouts, and Finance sign-off are required before production money movement.

## Form 990 boundary

The workspace selects 990-N or full Form 990 preparation paths, stores sections and validations, builds filing artifacts, and records transmission events. Production Modernized e-File transmission remains disabled until HPG or its filing partner has an approved IRS e-file provider configuration, EFIN/ETIN, current schema support, and successful Assurance Testing System status. Form 990-N uses an authenticated IRS handoff.

## Deferred scope

Payroll and payroll-tax filing remain reserved but intentionally deferred. Operational go-live testing remains a separate sign-off step, as approved for this phase.

## Verification

- Frontend/type/lint checks: `npm run verify:finance`
- Database contract: `scripts/finance/test_ngo_finance_platform.sql`
- Supabase Security and Performance Advisors should be rerun after every schema change.
