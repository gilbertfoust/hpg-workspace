# Agent OS Phase 5 — Continuous Monitoring and Proactive Intelligence

## Status

Phase 5 is deployed in the connected HPG production database and exposed in the HPG Assistant / NGO Coordination workspace at:

```text
/hpg-assistant#phase-5
```

The engineering and automated-control build is complete. The program is in `ready_for_human_review` and remains governed by eight formal human review gates.

## Purpose

Phase 5 allows HPG to identify significant developments before a staff member or executive must manually ask whether something is overdue, unowned, blocked, financially inconsistent, or approaching a material deadline.

The operating question changes from:

> What should someone remember to look for?

To:

> Which known condition is present, how serious is it, who owns the response, when must the response occur, and what evidence supports the alert?

Phase 5 monitors five categories:

1. compliance;
2. financial;
3. grant;
4. governance; and
5. operational.

## Operating boundary

Phase 5 may:

- read approved HPG Workspace sources;
- evaluate controlled monitoring rules;
- create internal alert records;
- attach evidence snapshots and hashes;
- calculate response and escalation times;
- deduplicate repeated detections;
- aggregate high-volume backlogs;
- apply authorized, time-bounded suppression windows;
- create internal escalation records;
- auto-resolve a cleared alert after the configured number of clear scans; and
- preserve a hash-chained alert history.

Phase 5 may not:

- send email;
- post to Slack;
- call an external connector;
- create corrective work automatically;
- change a source work item, grant, deadline, journal, expense, policy, or compliance record;
- move money;
- post a journal entry;
- submit a grant;
- sign a document;
- exercise a legal, financial, executive, employment, or Board decision; or
- perform autonomous remediation.

The controlling flags remain:

```text
work_item_creation_enabled = false
external_notifications_enabled = false
autonomous_remediation_enabled = false
```

## Continuous schedule

A protected `pg_cron` job runs every fifteen minutes:

```text
Job name: agent-os-phase5-scan-15m
Schedule: */15 * * * *
Command: select agent_runtime.phase5_run_scheduled_scan();
```

The scheduled function is not executable by authenticated browser users. A database advisory lock prevents concurrent scans.

The first automatic cron execution completed successfully on August 14, 2026, at 06:45 UTC.

## Alert severity matrix

| Level | Rank | Meaning | Default response | Default escalation | Human acknowledgement |
|---|---:|---|---:|---:|---|
| Informational | 1 | Useful awareness without immediate response | 24 hours | 7 days | No |
| Watch | 2 | Condition requiring observation or preparation | 24 hours | 72 hours | No |
| Action Required | 3 | Documented response required within the operating day | 8 hours | 24 hours | Yes |
| High Risk | 4 | Material risk requiring rapid management review | 2 hours | 8 hours | Yes |
| Critical | 5 | Urgent threat to compliance, funds, governance, safety, or continuity | 30 minutes | 2 hours | Yes |

A rule may specify a longer or shorter response or escalation interval when the source domain requires it.

## Monitoring rule contract

Every rule preserves:

- rule key and version;
- category;
- description;
- source system;
- condition type;
- base severity;
- threshold reference;
- Agent OS owner;
- accountable human role;
- required response;
- escalation path;
- scan frequency;
- lead period;
- duplicate-suppression window;
- missed-run auto-resolution threshold;
- aggregation method;
- access area;
- confidentiality; and
- active, controlled, paused, or retired status.

## Production rule library

Phase 5 currently contains thirty-one controlled monitoring rules.

### Compliance

- compliance obligation due soon;
- compliance obligation overdue;
- NGO compliance period due soon;
- NGO compliance period overdue;
- program reporting requirement due soon; and
- program report overdue.

### Financial

- unbalanced finance journal;
- stale draft journal;
- expense request missing receipt;
- expense review stalled;
- budget-line overspend;
- approved cash forecast becoming negative;
- recurring transaction overdue; and
- open high or critical Controller alert.

### Grant

- grant deadline due soon;
- grant deadline overdue;
- application near deadline without owner;
- blocked application near deadline;
- overdue application task;
- award obligation due soon;
- award obligation overdue; and
- opportunity approaching deadline without current verification.

### Governance

- policy review due soon;
- policy review overdue;
- overdue Board-candidate backlog;
- stalled required approval; and
- pending Agent OS governance reviews approaching their due date.

### Operational

- overdue work-item backlog aggregated by module;
- due-soon unowned work aggregated by module;
- overdue HR onboarding, training, access, or offboarding task; and
- open high or critical program risk.

## Monitored source registry

Phase 5 currently monitors twenty-one source tables:

1. `compliance_obligations`
2. `ngo_compliance_periods`
3. `program_reporting_requirements`
4. `program_reports`
5. `finance_journal_entries`
6. `finance_expense_requests`
7. `finance_budgets`
8. `cash_flow_forecasts`
9. `recurring_transactions`
10. `grant_deadlines`
11. `grant_applications`
12. `grant_application_tasks`
13. `grant_award_obligations`
14. `grant_opportunities`
15. `policy_registry`
16. `board_candidate_profiles`
17. `approvals`
18. `work_items`
19. `hr_onboarding_tasks`
20. `program_risk_flags`
21. `controller_alerts`

Every source has an assigned Agent OS owner, category, access area, confidentiality classification, last-scan time, row count, signal count, active-alert count, and error state.

## Financial and operating threshold library

Fourteen draft thresholds were created for:

- deadline proximity;
- overdue age;
- budget variance percentage;
- budget variance amount;
- cash runway;
- expense-review delay;
- journal-draft age;
- grant-deadline proximity;
- backlog size;
- oldest backlog age;
- approval delay;
- verification staleness;
- risk score; and
- financial-integrity failure.

Every threshold is marked:

```text
draft_pending_human_review
```

The threshold library is operationally visible but does not become an HPG policy merely because it has been encoded. Finance, General Counsel, Development, Program, Operations, Human Resources, Technology, Efficiency, and executive reviewers retain authority to revise or reject it.

## Alert evidence model

Every alert follows this chain:

```text
Authoritative HPG source condition
        ↓
Monitoring rule and threshold
        ↓
Evidence snapshot
        ↓
SHA-256 evidence fingerprint
        ↓
Alert fingerprint
        ↓
Active alert or authorized suppression
        ↓
Response and escalation deadlines
        ↓
Human acknowledgement, snooze, resolution, or dismissal
        ↓
Hash-chained alert events
```

The alert fingerprint is based on the rule, source record or aggregation key, entity, and validation context. It prevents repeated scans from producing duplicate active alerts.

## Deduplication

The first production scan created sixteen alerts from sixteen signals.

The next scan detected the same sixteen conditions and created no new alerts. It recorded sixteen deduplicated signals and incremented occurrence counts on the existing alerts.

After Phase 5 governance work items were created, the schedule detected one additional governance condition. The subsequent scheduled scan evaluated seventeen signals and deduplicated all seventeen without creating another alert.

## Aggregation

High-volume operational conditions are aggregated instead of producing one alert for every source row.

For example:

```text
50 unowned due-soon work items
        ↓
Grouped by Workspace module
        ↓
One evidence-backed alert per affected module
```

The aggregate alert preserves:

- affected module or owner;
- count;
- oldest or earliest due date;
- affected record identifiers; and
- the evidence snapshot used to calculate severity.

## Suppression and snooze

A snooze is not deletion.

Management may create a suppression only when it includes:

- alert or rule scope;
- entity or aggregation scope;
- written reason;
- human authorizer;
- start time;
- end time no more than thirty days later; and
- audit history.

Signals detected during the window remain recorded as suppressed. The alert may reopen after expiration if the source condition remains present.

## Internal escalation

When a response remains unresolved beyond its escalation time, Phase 5 creates an internal escalation record containing:

- escalation level;
- originating Agent OS owner;
- receiving Agent OS owner or human role;
- reason;
- due time;
- acknowledgement; and
- resolution.

This does not send an email or connector message. It preserves internal routing for the Workspace interface and later human action.

## Auto-resolution

A cleared source condition does not disappear from history.

When a rule is configured for auto-resolution, the alert is resolved only after the condition is absent for the required number of consecutive scans. The system records:

- missed-run count;
- resolution time;
- signal-cleared explanation; and
- hash-chained resolution event.

If the condition returns, the alert may reopen with a new event while preserving its earlier history.

## Production alert state at deployment

At the completion of the Phase 5 build, the live system contained seventeen active alerts:

| Severity | Active alerts |
|---|---:|
| Critical | 5 |
| High Risk | 7 |
| Action Required | 5 |
| Watch | 0 |
| Informational | 0 |

| Category | Active alerts |
|---|---:|
| Compliance | 0 |
| Financial | 1 |
| Grant | 0 |
| Governance | 4 |
| Operational | 12 |

The absence of an alert in a category means that the monitored rule did not find a qualifying condition in the currently available source data. It does not mean the organization has no risk outside the connected records.

The current alert set includes:

- fifteen overdue active Board-candidate profiles;
- a draft finance journal more than fourteen days old;
- module-level overdue work backlogs;
- module-level due-soon unowned work; and
- Phase 3, Phase 4, and Phase 5 governance-review work approaching their due dates.

## Validation scenarios

Eight required scenarios passed:

1. routine due-soon deadline;
2. overdue high-risk obligation;
3. duplicate-signal deduplication;
4. authorized suppression window;
5. aggregate backlog;
6. cleared-signal auto-resolution;
7. internal escalation with no external action; and
8. external NGO persona isolation.

The latest validation produced:

- 8 of 8 scenarios passed;
- 29 of 29 assertions passed;
- 16 of 16 automated and security gates passed;
- zero external side effects;
- zero authoritative source mutations; and
- unchanged source fingerprints before and after validation.

## Security boundary

- All fifteen Phase 5 tables enforce RLS.
- Anonymous reads are denied.
- Authenticated browser roles have no direct insert, update, or delete privileges.
- Public Phase 5 RPC wrappers use invoker security.
- Governed runtime functions enforce internal, departmental, management, or super-administrator authority.
- An approved external NGO persona receives zero rows from every Phase 5 view.
- An external NGO alert-mutation attempt is rejected.
- Scheduled scan execution is protected from browser users.
- Alert-event history is hash chained.
- Source data remains unchanged by scans and validation.

## Workspace control center

The Phase 5 panel includes:

- live alert queue;
- category, severity, status, and text filters;
- evidence-backed alert details;
- acknowledgement;
- bounded snooze and suppression;
- evidence-based resolution;
- management dismissal;
- monitoring rule library;
- severity matrix;
- threshold library;
- source coverage;
- validation results;
- governance gates;
- scan history;
- suppression history; and
- internal escalation queue.

## Human governance gates

Eight reviews remain pending:

1. Compliance and Legal monitoring review
2. Finance monitoring review
3. Grant and Development monitoring review
4. Governance and Board monitoring review
5. Operations, Program, and Human Resources monitoring review
6. Technology validation
7. Efficiency quality assurance
8. Executive authorization

Each review has an evidence-required Workspace item. The program cannot enter `pilot` while a required human gate is pending or failed.

Even after every human gate passes:

```text
work_item_creation_enabled = false
external_notifications_enabled = false
autonomous_remediation_enabled = false
```

Any future expansion of authority would require a separate governed phase and explicit approval.

## Production database entry points

Read views:

- `agent_os_phase5_dashboard`
- `agent_os_phase5_alert_queue`
- `agent_os_phase5_rule_library`
- `agent_os_phase5_severity_matrix`
- `agent_os_phase5_threshold_library`
- `agent_os_phase5_source_coverage`
- `agent_os_phase5_scan_history`
- `agent_os_phase5_validation_results`
- `agent_os_phase5_governance`
- `agent_os_phase5_suppressions`
- `agent_os_phase5_escalation_queue`
- `agent_os_phase5_alert_events`

Governed RPCs:

- `agent_os_phase5_run_scan()`
- `agent_os_phase5_run_validation()`
- `agent_os_phase5_acknowledge_alert(...)`
- `agent_os_phase5_snooze_alert(...)`
- `agent_os_phase5_resolve_alert(...)`
- `agent_os_phase5_dismiss_alert(...)`
- `agent_os_phase5_record_gate_review(...)`

## Verification

Run:

```text
scripts/agent-os/verify-phase5.sql
```

The production Supabase migration ledger remains the authoritative record of applied Phase 5 database changes. The repository contains the Workspace interface, architecture documentation, production migration ledger, and repeatable verification script.
