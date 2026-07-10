# Agent OS staging safety continuation — 2026-07-10

## Environment and boundary

- Supabase branch: `agent-os-staging`
- Staging project ref: `gvzpeaktuaiqexzzdren`
- Production data copied: **No**
- Live Gmail intake: **Disabled**
- Live email and Slack delivery: **Disabled**
- Live Trello writes: **Disabled**
- Live payment processing: **Disabled**

This record supplements `_staging/agent-os-staging-validation-2026-07-10.md`. It does not authorize production promotion or external actions.

## PR #108 — overdue and material-risk escalation

Migration: `20260710153135_agent_os_case_escalation_schedule`

Added:

- `case_escalation_events`
- `agent_os_business_days_overdue(...)`
- `agent_os_process_overdue_escalations(...)`
- `agent_os_pending_escalations`
- idempotency, pending-event, and case-history indexes
- RLS policies for internal access
- stale-event cancellation when a case closes, is archived, or its due date changes

Validated with fabricated cases:

1. A nonmaterial case 12 business days overdue generated the due-date, Director, VP, and Noemi levels, but did not generate the material CEO level.
2. A material case 12 business days overdue generated those levels plus the CEO level.
3. An urgent high-risk safeguarding case generated an immediate escalation before its due date.
4. A second processor run generated no duplicates.
5. Moving the routine case due date into the future cancelled four stale pending escalation events.

The processor creates internal events only. It does not send email, Slack messages, Trello cards, or payments.

## PR #109 — unmatched clarification human-review gate

Migration: `20260710154500_agent_os_unmatched_clarification_review_gate`

Added a database trigger that protects clarification messages linked to cases where:

- match confidence is low, none, or unmatched; or
- an unmatched reason remains recorded.

For those messages, the trigger enforces:

- `authority_level = draft_for_review`
- `requires_human_review = true`
- worker-eligible states are returned to `pending_review`
- source context records that the safety gate was applied

Validation:

1. The fabricated unmatched clarification was backfilled from automatic/pending to draft-for-review/pending-review.
2. A direct attempt to reset it to automatic/pending was intercepted by the trigger.
3. No external clarification was sent.

This resolves the Program pilot's unmatched-intake policy conflict conservatively: identity clarification may be drafted, but it cannot be delivered automatically before human review.

## Updated Nia pilot result

- Provisional QA score: **17/22**
- Scenario 2 — unmatched intake: **Pass at database-control level**
- Scenario 5 — overdue NGO report: **Partial pass at database-schedule level**
- Overall disposition: **Not production-ready**

## Remaining gates

- attachment validation, standardized naming, Drive placement, checklist update, and linked audit evidence;
- credentialed communication, Trello, and escalation-worker dry runs;
- external escalation destination resolution and acknowledgment/recovery testing;
- approved Finance, Development, HR, and Nominations Trello mappings;
- terminal-failure and recovery scenario completion;
- the Nia → Yakubu → Amina → Noemi reporting chain;
- Technology, Finance, Development, Program, General Counsel, Efficiency, and Executive sign-off;
- approved production promotion and rollback plans;
- staging-branch deletion after validation to stop hourly billing.
