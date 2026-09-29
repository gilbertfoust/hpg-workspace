# Workspace account email and error workflows

## Account messages

New self-service registrations queue one `workspace_signup_received` receipt.
It acknowledges signup and asks the applicant to wait for approval. Administrator-created
accounts do not receive this receipt, and there is no historical backfill.

NGO and staff/board approvals retain their separate eligibility checks. Their email explains
sign-in access, the new workspace's known errors and ongoing repairs, and how to reply with
an error message and screenshot. All applicant messages use the authenticated
`itsupport@humanitypathwaysglobal.com` Gmail connection for From and Reply-To.

The application's Gmail SMTP account rewrites an IT From header to its own address.
An actual delivery test confirmed this on 2026-09-29, so changing the header alone is
insufficient. A separate test of the connected IT Gmail mailbox confirmed its actual
From and Reply-To addresses.

The notification worker sends an **internal wakeup** to IT with subject
`HPG Workspace account email ready`. The enabled **HPG IT account emails** ChatGPT
event automation validates the incoming message and delivers only database-authorized
account notices through IT. The wakeup contains a notification UUID, not applicant text.

| State | Meaning |
| --- | --- |
| `queued` / `retry` | Awaiting preparation or an internal wakeup |
| `leased` | Application worker preparing an internal wakeup |
| `awaiting_it_delivery` | Wakeup accepted; applicant email still unsent |
| `it_delivery_leased` | IT automation holds an exclusive 15-minute claim |
| `sent` | IT Gmail accepted the applicant message and its real message ID was recorded |
| `cancelled` | Account no longer eligible, or a newer approval superseded an unsent notice |
| `deadletter` | Delivery needs reconciliation; never blindly resend |

The delivery automation calls `claim_workspace_it_delivery`, searches IT Sent mail for the
notification reference, calls `begin_workspace_it_delivery`, sends the exact returned
template/address through IT Gmail, and calls `finish_workspace_it_delivery` with the
actual Gmail message ID. Preparation checks use `auth.users.email`, current approval/access
state, and the NGO activation ID where applicable. A signup receipt grants no access and
may be sent before email verification. Approval notices wait for verification.

The send-start marker is durable. An uncertain send or an expired started lease is
quarantined rather than automatically repeated. Successful acknowledgments are idempotent
by Gmail message ID. Unattended internal wakeups repeat hourly, without resending the
applicant email. Successful internal wakeups do not count as applicant delivery in worker
health. Existing approval CRM/activity logging happens only at actual applicant acceptance.

Provider acceptance does not guarantee inbox placement. Delivery also depends on the IT
Gmail and Supabase connections and the ChatGPT event automation remaining enabled.

## Error troubleshooting

Existing application error emails to IT remain active with exact subject
`HPG Workspace error detected`. The enabled **HPG error troubleshooting** ChatGPT event
automation validates each alert against its database notification and source error.

Each unique error is claimed in `private.workspace_error_troubleshooting`. The automation
explicitly dispatches a worker using `gpt-6-sol`, reasoning effort `max`, and a self-contained
task. The automation API does not expose a native orchestrator model selector; the model
requirement applies to the dispatched troubleshooting worker. If exact dispatch is
unavailable, the task records a block and does not substitute another model.

The worker investigates relevant source, deployed functions, schema and logs; reproduces
where practical; prepares a minimal fix; and validates it. It distinguishes diagnosis,
prepared changes, and deployed fixes. Consequential production changes still follow the
applicable approval requirements. Private data and raw logs must not appear in public PRs.

The private ledger records sanitized findings, evidence references, and results under a
one-hour exclusive lease. Completed/blocked events do not replay automatically. The model
columns describe required settings; `completed` requires actual execution by that worker,
while a model-unavailable block must explicitly state that no worker ran.

## Verification and maintenance

- SQL rollback tests cover signup deduplication, current authoritative recipients, stale
  cancellation, IT leases, duplicate send protection, acknowledgments, reminders and grants.
- Error ledger rollback tests cover deduplication, lease expiry, wrong settings/tokens,
  terminal states and bounded report fields. Synthetic test data is rolled back.
- The worker continues on its existing every-minute scheduler and secret-authenticated
  endpoint. No applicant password, token or service credential is put in emails.
- Database mutations use reviewed individual migrations. Do not replace production
  functions from an older repository snapshot or run a broad database push without
  checking production drift.
- Reconcile ambiguous deliveries against the exact IT Sent message, recipient, subject
  and `Reference:` UUID before any resend. A new approval must not bypass an unresolved
  previous send.
