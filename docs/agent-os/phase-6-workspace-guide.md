# Phase 6 Workspace Operating Guide

## Executive command location

Open:

```text
/agent-os
```

The same Phase 6 panel is also visible at the top of the HPG Assistant / NGO Coordination workspace.

## Executive Brief

The first tab shows Noemi Vale's latest internal command brief.

It includes:

- overall organizational health;
- overall risk score;
- Critical departments;
- active and Critical decisions;
- department summaries;
- highest current risks;
- priority CEO decisions;
- grant and strategic opportunities;
- known data limitations;
- source hash; and
- packet hash.

“People waiting on me” means active decisions awaiting CEO review or direction. “Waiting on others” means packets deferred or returned for evidence.

## CEO Decision Queue

Filter by:

- text;
- status;
- category; and
- severity.

Opening a decision displays:

- decision question;
- context;
- deadline;
- priority, urgency, impact, evidence, confidence, and readiness scores;
- Noemi recommendation;
- multiple options;
- evidence;
- institutional memory or precedent limitation;
- specialist support, concern, or dissent;
- assumptions;
- dependencies;
- risks;
- expected outcomes;
- source snapshot;
- event history; and
- packet fingerprints.

### Begin CEO review

Only the named Chief Executive may begin executive review. Review notes are required.

### Record the CEO decision

The CEO must select an existing packet option and provide:

- decision code;
- decision text;
- rationale;
- conditions; and
- evidence reference.

Recording the decision does not execute the option.

### Record a specialist position

Authorized internal reviewers may preserve a domain-agent position:

- recommend;
- support;
- concern;
- dissent;
- abstain; or
- insufficient evidence.

The backend validates the agent, source-area access, packet option, rationale, confidence, and evidence references.

## Department Command

The Department Command tab contains one card for every module.

Each card shows:

- lead agent;
- human authority;
- health status;
- capacity score;
- risk score;
- decision-pressure score;
- open work;
- overdue work;
- due-soon work;
- unowned work;
- active alerts;
- active assignments;
- board count;
- agent count;
- trend; and
- whether an executive capacity decision is active.

## Agent Work

The Agent Work tab combines all department queues.

Search by:

- work title;
- description;
- department;
- agent;
- human owner;
- NGO;
- reference;
- workflow stage; or
- next action.

Opening an assignment displays the lead-agent rationale, source next action, source snapshot, and evidence hash.

Authorized reviewers may record:

```text
acknowledged
in_progress
blocked
declined
queued
```

This changes only the Phase 6 assignment record. It does not change the source work item.

## Native department agent workspaces

Every department module now contains its own Agent Workspace panel under the `#agent-work` anchor.

Examples:

```text
/modules/finance#agent-work
/modules/development#agent-work
/modules/legal#agent-work
/modules/ngo-coordination#agent-work
```

The department panel provides the local health snapshot and only the assignments for that module.

## Validation

The Validation tab displays the eight required scenarios and thirty-two assertion results.

A passing scenario confirms technical behavior. It does not approve the department scoring model or authorize executive use.

## Governance

The Governance tab displays:

- twenty-one automated and security gates;
- eight human gates;
- required reviewer;
- linked Workspace item;
- due date;
- evidence;
- notes; and
- decision state.

## Cutover and History

The Cutover section confirms:

- all seventy-seven agents have Workspace routes;
- all seventy-seven agents use historical-only Trello provenance;
- thirteen native agent-work boards exist;
- thirty-nine active boards are bound to an Agent OS owner;
- zero source work items use Trello synchronization; and
- zero Trello queue items are pending or processing.

The refresh history shows:

- source work count;
- assignment count;
- assignments created, updated, or closed;
- snapshots;
- decision candidates;
- decisions created or updated;
- briefs created;
- external side effects; and
- authoritative source mutations.

The expected integrity values for external effects and source mutations are always zero.

## Safe interpretation

A high department risk score means that the connected operational records contain conditions such as overdue work, unowned deadlines, evidence gaps, approval delays, or material alerts.

It does not establish that a staff member, volunteer, department leader, or sponsored organization is performing poorly. Human reviewers must examine the source records and context.
