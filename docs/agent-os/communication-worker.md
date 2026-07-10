# Agent OS Communication Worker

Status: **implemented in code; not deployed or enabled for live delivery**.

## Safety posture

The worker is dry-run by default. Live sending requires all of the following:

1. The runtime foundation and communication-worker migrations are deployed.
2. `AGENT_OS_COMMUNICATIONS_LIVE=true` is installed as a Supabase secret.
3. `RESEND_API_KEY` is installed.
4. `AGENT_OS_FROM_EMAIL` or `FORM_WORKFLOW_FROM_EMAIL` is installed and verified with the provider.
5. The invocation body explicitly includes `"live": true`.
6. The caller authenticates with either an internal-user JWT or `AGENT_OS_WORKER_SECRET`.

Missing any one condition prevents live delivery.

## Queue authority

The worker only claims records where:

- `authority_level = automatic`;
- status is `pending` or `approved`;
- the retry time has arrived;
- attempts are below three.

It cannot claim `draft_for_review` or `human_only` communications.

## Dry-run invocation

```json
{
  "limit": 10,
  "live": false
}
```

Dry run returns eligible queue metadata without claiming or sending messages.

## Live invocation

```json
{
  "limit": 10,
  "live": true
}
```

Live mode should be enabled only after sender-domain verification and sandbox tests.

## Retry policy

- Attempt 1 failure: return to queue after 5 minutes.
- Attempt 2 failure: return to queue after 15 minutes.
- Attempt 3 failure: mark failed and preserve the error.
- A processing lock older than 15 minutes is recovered automatically; records at three attempts become failed.

## Audit behavior

Each claimed communication creates or updates an `agent_runs` record containing:

- queue record identifier;
- case and work-item links;
- agent name;
- authority and channel metadata;
- attempt number;
- result or error;
- changed record reference.

The email body and credentials are not copied into the run log.

## Required test cases

1. Dry run with no eligible communications.
2. Dry run with one automatic communication.
3. Draft-for-review communication is never claimed.
4. Human-only communication is never claimed.
5. Missing recipient is blocked without sending.
6. Missing subject or body is blocked without sending.
7. Missing provider configuration returns 503 before a claim.
8. Provider success marks sent and records the external message ID.
9. First and second failures schedule retries.
10. Third failure marks failed.
11. Stale processing lock is recovered.
12. Repeated invocation does not duplicate a sent communication.

## Production checklist

- [ ] Apply migrations to a disposable branch or local database.
- [ ] Verify RLS and RPC permissions.
- [ ] Install a test Resend key and verified test sender.
- [ ] Install `AGENT_OS_WORKER_SECRET`.
- [ ] Keep `AGENT_OS_COMMUNICATIONS_LIVE` unset during dry-run testing.
- [ ] Insert fabricated automatic, review, and human-only queue records.
- [ ] Confirm only automatic records are eligible.
- [ ] Enable live mode in the test environment.
- [ ] Verify retry and idempotency behavior.
- [ ] Obtain Technology and department-supervisor approval.
- [ ] Deploy to production with live mode still disabled.
- [ ] Perform a final dry run.
- [ ] Enable production live mode during a controlled window.
