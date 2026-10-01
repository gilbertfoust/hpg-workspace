# Agent OS Phase 6 — Workspace-Native Operations and Executive Command

## Status

Phase 6 is deployed in the connected HPG production database and exposed through:

```text
/agent-os
```

The executive command panel is also mounted in the HPG Assistant / NGO Coordination workspace, while each department module now contains its own native agent-work queue.

The engineering and automated-control build is complete. The program is `ready_for_human_review` with twenty-one automated and security gates passed and eight human governance gates pending.

## Purpose

Phase 6 converts Agent OS from a collection of governed agents and separate phase control centers into a Workspace-native operating structure.

It answers four institutional questions:

1. Which Agent OS role should examine each active work item?
2. What is the current operating health, capacity, and risk state of each HPG department?
3. Which conditions require executive judgment rather than departmental handling?
4. What evidence, alternatives, specialist positions, precedent, assumptions, and consequences should reach the CEO?

Phase 6 does not replace human departmental leadership or executive judgment. It structures evidence and accountability around those authorities.

## Operating hierarchy

```text
Authoritative HPG Workspace records
        ↓
Department-native agent queues
        ↓
Department command snapshots
        ↓
Phase 5 monitoring and Phase 4 memory
        ↓
Domain-agent positions and dissent
        ↓
Noemi Vale executive synthesis
        ↓
CEO decision queue
        ↓
Human executive decision
        ↓
Human-led implementation outside Phase 6
```

Noemi Vale prepares the executive brief and decision packet. Gilbert Foust, as the named Chief Executive, remains the only person who may begin executive review or record the final CEO decision through the Phase 6 decision controls.

## Authority boundary

Phase 6 may:

- map active Workspace work items to one governed lead-agent assignment;
- maintain department-native agent queues;
- preserve the source work-item snapshot and SHA-256 fingerprint;
- calculate assignment priority and risk;
- summarize departmental workload, deadlines, ownership, evidence, approvals, alerts, boards, and agent coverage;
- calculate capacity, risk, and decision-pressure scores;
- classify department health;
- convert material risks, capacity constraints, grant choices, and governance gates into executive decision packets;
- preserve multiple options and consequences;
- attach primary evidence and institutional memory;
- preserve support, concern, dissent, abstention, or insufficient-evidence positions;
- prepare a Noemi executive brief;
- preserve hash-chained decision history; and
- route human governance reviews.

Phase 6 may not:

- change the human owner of a source work item;
- complete, archive, approve, reject, or delete a source work item;
- send email, Slack, SMS, or connector communication;
- submit a grant;
- post, transfer, approve, or pay financial activity;
- make a legal or Board determination;
- make an employment decision;
- record a CEO decision autonomously;
- execute a selected decision option; or
- reactivate Trello as an operating system.

The controlling flags remain:

```text
native_workspace_authoritative = true
trello_operational_enabled = false
external_actions_enabled = false
autonomous_decisions_enabled = false
source_mutations_enabled = false
assignment_execution_enabled = false
```

## Thirteen department-native workspaces

| Workspace module | Lead Agent OS owner | Human authority |
|---|---|---|
| NGO Coordination | Nia Okafor | Program and NGO Coordination leadership |
| Administration | Sophia Martinez | Administration leadership |
| Operations | Marcus Chen | Operations leadership |
| Program | Amina Okafor | Program leadership |
| Curriculum | Daniel Reyes | Program and Curriculum leadership |
| Development | Selah Brooks | Development leadership |
| Partnership Development | Adrian Cole | Development and Partnership leadership |
| Marketing | Fatima El-Sayed | Marketing leadership |
| Communications | Olivia Johnson | Communications leadership |
| Human Resources | Kofi Asare | Human Resources leadership |
| Information Technology | Arun Mehta | Technology leadership |
| Finance | Daniel Mensah | Finance leadership |
| Legal and General Counsel | Amara Patel | General Counsel or authorized legal reviewer |

Omar Nasser provides common work-item routing support. Beatrice Mensah and Omar Farouk provide monitoring and control support according to department needs.

## Native board model

Phase 6 created one explicit agent-work board for every module:

```text
agent_work_ngo_coordination
agent_work_administration
agent_work_operations
agent_work_program
agent_work_curriculum
agent_work_development
agent_work_partnership
agent_work_marketing
agent_work_communications
agent_work_hr
agent_work_it
agent_work_finance
agent_work_legal
```

These virtual boards are source-controlled views of Workspace work. They do not duplicate or replace the source work item.

Phase 6 also binds the existing material Workspace boards to a department profile and default Agent OS owner. The current operating registry contains thirty-nine active native boards and thirty-nine active board bindings.

## Seventy-seven-agent Workspace cutover

Every configured Agent OS identity now has:

- a native Workspace route;
- a department or executive operating destination;
- `trello_mode = historical_provenance_only`; and
- no active Trello work-item synchronization authority.

Cutover controls show:

```text
Configured agents: 77
Agents with Workspace routes: 77
Agents with historical-only Trello mode: 77
Trello-synced work items: 0
Active Trello queue items: 0
```

Trello remains available only as preserved historical provenance from Phase 4.

## Agent assignment model

Each active work item in a mapped module receives one Phase 6 lead-agent assignment.

The assignment contains:

- source work-item identifier;
- department profile;
- access area;
- lead agent;
- routing agent;
- existing human owner;
- assignment status;
- assignment reason;
- confidence score;
- priority score;
- risk score;
- source status and priority;
- due date;
- evidence and approval state;
- source snapshot;
- source SHA-256 fingerprint;
- refresh lineage; and
- human acknowledgement notes.

A unique work-item constraint prevents duplicate lead-agent assignments. Repeated refresh updates the evidence and score rather than creating a second assignment.

## Department command snapshots

Every refresh creates one snapshot for each of the thirteen modules.

A snapshot reconciles:

- open work;
- overdue work;
- work due within seven days;
- unowned work;
- unowned work due within seven days;
- blocked work;
- high-priority work;
- evidence gaps;
- approvals pending;
- active Phase 5 alerts;
- Critical and High Risk alerts;
- active agent assignments;
- native board count;
- configured agent count;
- capacity score;
- risk score;
- decision-pressure score;
- health classification;
- trend direction;
- principal risks; and
- recommended human actions.

The current health classifications are:

```text
healthy
watch
action_required
high_risk
critical
```

Scores are deterministic operating indicators, not predictions of human performance or employment suitability.

## Executive decision queue

Phase 6 currently creates decision candidates from:

1. Critical or High Risk compliance, financial, grant, and governance alerts;
2. Critical department-capacity snapshots;
3. grant-action records requiring executive direction; and
4. Agent OS executive-authorization work items.

Each active decision packet contains:

- permanent decision reference;
- source type and source record;
- category and decision type;
- question requiring judgment;
- current context;
- deadline;
- urgency score;
- impact score;
- reversibility score;
- evidence-strength score;
- confidence score;
- readiness score;
- composite priority score;
- severity;
- Noemi preparer identity;
- requesting domain agent;
- named CEO authority;
- recommendation;
- recommendation rationale;
- assumptions;
- dependencies;
- risks;
- expected outcomes;
- source snapshot and source hash;
- packet hash;
- options;
- evidence;
- agent positions and dissent;
- review and decision status; and
- hash-chained events.

## Decision options

The decision engine creates materially different options based on the source condition.

Examples include:

- pursue, hold, or decline a grant;
- authorize, return, or defer a governed phase;
- immediate triage, formal recovery plan, or monitored continuation for a capacity problem;
- immediate Finance review, evidence hold, or controlled deferral for financial risk; and
- immediate remediation, specialist review, or controlled deferral for compliance and governance risk.

Phase 6 records consequences, benefits, risks, conditions, effort, timeline, and reversibility for each option.

## Explainability and institutional memory

A decision packet must include primary source evidence. It also attempts to attach a relevant verified Phase 4 institutional-memory record.

When no verified precedent is found, the packet records an explicit limitation:

> No verified Phase 4 precedent was found. The absence is a limitation, not evidence that no precedent exists.

This distinction prevents the system from converting an incomplete search result into a false organizational conclusion.

## Specialist positions and dissent

Phase 6 preserves agent positions as:

```text
recommend
support
concern
dissent
abstain
insufficient_evidence
```

Noemi's recommendation does not erase a contrary specialist view. The validation suite includes a dissent position from the Agent Governance function to confirm that contrary judgment remains visible in the packet.

## Noemi executive brief

Every successful refresh produces a Noemi-prepared brief addressed to the named CEO.

The brief contains:

- overall organizational health;
- overall risk score;
- department summaries;
- Critical departments;
- top risks;
- top executive decisions;
- grant and strategic opportunities;
- known data limitations;
- source fingerprint;
- packet fingerprint;
- zero-external-action count; and
- zero-source-mutation count.

The rolling brief provides live command state. HPG may later use a separately governed connector workflow to archive a daily brief in the CEO Drive; Phase 6 itself performs no external write.

## Continuous refresh

A protected database schedule runs every thirty minutes:

```text
Job name: agent-os-phase6-refresh-30m
Schedule: */30 * * * *
Command: select agent_runtime.phase6_run_scheduled_refresh();
```

The function:

- uses an advisory concurrency lock;
- is unavailable to browser roles;
- refreshes assignments;
- creates department snapshots;
- updates or creates decision packets;
- withdraws stale queued decisions when their source condition clears;
- creates one executive brief;
- records metrics and audit evidence;
- makes no external call; and
- makes no authoritative source mutation.

## Validation

Eight required scenarios passed:

1. native department and board coverage;
2. assignment coverage and idempotency;
3. department snapshot reconciliation;
4. material monitoring alert to decision packet;
5. capacity aggregation to one decision;
6. evidence, precedent, explainability, and dissent;
7. CEO-only decision authority; and
8. external NGO persona isolation.

The latest suite produced:

```text
8 / 8 scenarios passed
32 / 32 assertions passed
21 / 21 automated and security gates passed
0 external side effects
0 authoritative source mutations
source fingerprint unchanged
```

## Security boundary

- All sixteen Phase 6 tables enforce RLS.
- Anonymous table reads are denied.
- Authenticated direct insert, update, and delete privileges are denied.
- Fourteen public read views use invoker security.
- Public mutation wrappers use invoker security.
- Governed runtime functions enforce internal, departmental, executive, management, super-administrator, or CEO authority.
- An approved external NGO persona receives zero rows from all fourteen views.
- An external refresh attempt is rejected.
- An external executive-review attempt is rejected.
- The scheduled refresh function is not executable by authenticated browser roles.
- Decision evidence and events are SHA-256 fingerprinted.
- Decision events form a hash-linked lifecycle chain.

## Human governance gates

Eight evidence-required human reviews remain pending:

1. Administration and Executive Secretariat review
2. Operations and department-routing review
3. Program and NGO Coordination review
4. Finance and Development review
5. General Counsel, privacy, and governance review
6. Technology validation
7. Efficiency and model-risk quality assurance
8. Chief Executive authorization

The program cannot enter `pilot` while any required gate is pending or failed.

Even after every human gate passes:

```text
external_actions_enabled = false
autonomous_decisions_enabled = false
source_mutations_enabled = false
assignment_execution_enabled = false
```

A separate governed change would be required to expand operating authority.

## Production entry points

Read views:

- `agent_os_phase6_dashboard`
- `agent_os_phase6_department_command`
- `agent_os_phase6_agent_work_queue`
- `agent_os_phase6_executive_briefs`
- `agent_os_phase6_decision_queue`
- `agent_os_phase6_decision_options`
- `agent_os_phase6_decision_evidence`
- `agent_os_phase6_decision_positions`
- `agent_os_phase6_decision_events`
- `agent_os_phase6_refresh_history`
- `agent_os_phase6_validation_results`
- `agent_os_phase6_governance`
- `agent_os_phase6_board_coverage`
- `agent_os_phase6_native_cutover`

Governed RPCs:

- `agent_os_phase6_refresh()`
- `agent_os_phase6_run_validation()`
- `agent_os_phase6_update_assignment(...)`
- `agent_os_phase6_begin_decision_review(...)`
- `agent_os_phase6_record_decision(...)`
- `agent_os_phase6_record_position(...)`
- `agent_os_phase6_record_gate_review(...)`

## Verification

Run:

```text
scripts/agent-os/verify-phase6.sql
```

The production Supabase migration ledger remains the authoritative record of applied Phase 6 database changes.
