# Finance Hub Production Readiness

**Implementation status:** 100%

**Verification command:** `npm run verify:finance`

**Activation:** merge, apply the forward migration, then run the two read-only SQL verification scripts.

## Completed capability

The Financial Hub now provides one operational control plane for:

- expense requests from draft through submission, approval/rejection, and payment;
- purchase requests with requestor-only submission and Finance-manager approval;
- atomic budget preparation, submission, and approval;
- automatic Finance work-item creation for every submitted workflow;
- durable Slack/email notification events with queued, sent, skipped, and failed states;
- a unified approval queue and visible notification outbox;
- database-enforced Finance authority, scoped to the Finance department;
- audited CSV exports for all ten Finance reports.

## Authority matrix

| Action | Internal requestor | Finance staff | Finance manager | Auditor / board |
|---|---:|---:|---:|---:|
| Submit own expense or purchase request | Yes | Yes | Yes | No |
| Read own expense requests | Yes | Yes | Yes | No |
| Prepare and submit budgets | No | Yes | Yes | No |
| Approve or reject requests and budgets | No | No | Yes | No |
| Mark an approved expense paid | No | No | Yes | No |
| Read the accounting ledger | Yes | Yes | Yes | Yes |
| View the notification outbox | No | Yes | Yes | No |

Client-side controls improve usability, but the RPCs and row-level security policies are the source of truth. A generic staff role outside the Finance department no longer inherits Finance write access.

## Workflow guarantees

1. Direct Data API writes to expense requests, purchase requests, budgets, and budget lines are revoked.
2. State changes run through security-definer RPCs that validate the signed-in user and the current state.
3. Submitting a request creates a Finance `work_items` record and queues configured Slack/email events in the same database transaction.
4. Approval, rejection, and payment update the work item, Finance audit trail, and notification outbox atomically.
5. Notification records are an outbox, not a claim of delivery. A dispatcher must mark each event `sent` or `failed`.
6. CSV generation is canceled if its export audit record cannot be written.

## Release procedure

1. Merge the Finance completion pull request.
2. Apply migrations with the standard linked-project deployment workflow: `npx supabase db push`.
3. Run `scripts/finance/test_atomic_posting.sql`.
4. Run `scripts/finance/test_operational_workflows.sql`.
5. Confirm the Finance route in `department_notification_routes` points to the intended Slack channel and email recipients.
6. Confirm the notification dispatcher is running and drains `finance_workflow_events`.
7. Complete the role-based and accounting-scenario checks in `phase-12-certification-checklist.md`.

## Verification evidence

`npm run verify:finance` performs all repository-level release checks:

- production Vite build;
- TypeScript typecheck;
- scoped ESLint over the Finance completion surface;
- static assertions covering the route, three workflows, protected RPC contracts, RLS, notification outbox, atomic budget save, and all ten audited exports.

On 2026-07-13, the completion migration also compiled successfully against the connected HPG PostgreSQL schema inside a rollback-only transaction. A follow-up query confirmed that neither new table persisted.

The repository-wide `npm run lint` still reports legacy errors outside this change. Those errors are not suppressed or included in the Finance-specific gate.

## Connected-database gates

The connected database's tracked migration history currently ends at the June 30 HR email migrations, while the repository contains later July migrations. Review the complete pending migration set before using `supabase db push`; do not assume this Finance migration is the only pending change.

The live Supabase security advisor also reports that `profiles`, `ngos`, `transaction_number_counters`, and `hr_email_outbox` have RLS disabled. `profiles` and `ngos` already have policies, but those policies are not active until RLS is enabled. This completion migration does not change those shared tables because enabling RLS without first validating all application access paths can cause a workspace-wide outage. Resolve that security gate in a separate, explicitly approved migration.
