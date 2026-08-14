# Agent OS Phase 4 — Organizational Memory and Institutional Intelligence

## Status

Phase 4 is deployed in the connected HPG production database and exposed in the HPG Assistant / NGO Coordination workspace at:

```text
/hpg-assistant#phase-4
```

The engineering and automated-control build is complete. The program is in `ready_for_human_review` and remains governed by eight formal human review gates.

## Purpose

Phase 4 gives HPG a durable institutional answer to seven recurring questions:

1. Why was this decision made?
2. Who had authority to make it?
3. What evidence supported it?
4. Has this happened before?
5. What did HPG do the last time?
6. What changed afterward?
7. What was the result?

The system combines decision history, precedent, relationship context, grant intelligence, compliance memory, operational lessons, outcomes, and time-aware supersession.

## Memory classes

### Decision memory

Preserves:

- decision-maker;
- decision text;
- rationale;
- alternatives considered;
- evidence;
- expected outcome;
- actual outcome; and
- lessons.

### Precedent memory

Links verified records as:

- similar;
- supporting;
- conflicting;
- distinguished;
- overruled; or
- superseding.

Each link requires written rationale and confidence.

### Relationship memory

Preserves evidence-backed interactions with NGOs, funders, partners, donors, vendors, contacts, and organizations.

### Grant memory

Preserves research, opportunity, application, award, reporting, renewal, and result history.

### Compliance memory

Preserves findings, exceptions, remediation, finance-control events, review outcomes, and restricted evidence.

### Operational memory

Preserves case-stage history, Agent OS audit history, handoff patterns, recurring bottlenecks, and lessons from implementation.

## Time-aware memory

Every memory is classified as one of:

- current;
- historical;
- future;
- expired; or
- superseded.

A record with an expired effective period cannot be returned as a current fact. A verified replacement establishes reciprocal supersession links while preserving the older record.

## Production source adapters

Phase 4 currently ingests seven authoritative HPG Workspace sources:

1. `partnership_fsa_events`
2. `crm_interactions`
3. `workspace_audit_findings`
4. `grant_activities`
5. `case_stage_history`
6. `agent_audit_events`
7. `finance_audit_events`

The first controlled ingestion produced:

- 328 institutional memories;
- 328 primary evidence records; and
- 328 source snapshots with SHA-256 fingerprints.

A second refresh produced zero duplicate memories and zero duplicate evidence records.

## Evidence model

Every verified source memory includes:

```text
memory reference
  -> authoritative source record
  -> captured source snapshot
  -> SHA-256 source fingerprint
  -> primary evidence record
  -> entity links
  -> lifecycle and time state
  -> hash-chained memory events
  -> outcomes and lessons where available
  -> precedent or supersession links where applicable
```

Manual records enter as `proposed`. Verification requires management authority, primary evidence, review notes, and—in the case of decision memory—the complete decision context.

## Contradictory facts

When a proposed current fact conflicts with a verified current fact for the same entity and fact key, Phase 4:

1. retains the existing verified fact;
2. marks the new claim as a potential conflict;
3. creates an evidence-required Workspace work item;
4. blocks verification; and
5. requires an authorized reviewer to accept the new fact, retain the existing fact, or preserve both with contextual distinction.

## Outcomes and lessons

Verified memory may receive:

- actual outcome;
- outcome status;
- outcome evidence;
- structured lessons; and
- later precedent links.

This closes the institutional-learning loop rather than treating a decision as complete when it is merely recorded.

## Search and retrieval

The Phase 4 Workspace control center supports filtering and searching by:

- memory reference;
- title and summary;
- narrative and rationale;
- decision text;
- outcome;
- memory type;
- entity type and identifier;
- source system and table;
- tags;
- lifecycle status; and
- temporal state.

The Workspace interface includes:

- Memory Library;
- Record Memory;
- Precedent Library;
- Source Coverage;
- Validation;
- Governance; and
- Historical Provenance.

## Trello retirement

Phase 4 made HPG Workspace / Supabase the authoritative operating system.

Trello is now:

```text
historical_provenance_only
```

The system preserves 994 historical Trello records and references, but Trello can no longer:

- create or update a Workspace item;
- assign or remove a user;
- move a card or workflow stage;
- trigger an approval;
- synchronize a case;
- receive an outbound Workspace mutation; or
- write inbound webhook data.

Both Trello edge functions now return HTTP `410 Gone` and perform no reads, writes, routing, synchronization, or external requests.

## Required validation scenarios

1. Complete evidence-backed decision
2. Missing-evidence hold
3. Contradictory current fact
4. Expired fact classification
5. Supersession-chain integrity
6. Precedent relationship
7. Duplicate source idempotency
8. External NGO isolation

The latest production run passed:

- 8 of 8 required scenarios;
- 26 of 26 assertions;
- 12 of 12 automated and security gates;
- zero external side effects;
- zero authoritative source mutations; and
- unchanged source fingerprints before and after validation.

## Security boundary

- All fifteen Phase 4 tables enforce RLS.
- Anonymous access is denied.
- Authenticated browser roles have no direct insert, update, or delete privileges.
- Public Phase 4 RPC wrappers use invoker security.
- Internal and management checks execute inside governed runtime functions.
- An approved external NGO persona sees zero Phase 4 rows and receives zero search results.
- An external NGO persona cannot refresh sources, run validation, create memory, verify memory, link precedent, resolve conflict, or review a gate.
- External actions and autonomous high-impact decisions remain disabled.

## Human governance gates

1. Records and Administration review
2. Development and Grant review
3. Program and Relationship review
4. Finance and Compliance review
5. General Counsel privacy and retention review
6. Technology validation
7. Efficiency quality assurance
8. Executive authorization

The system cannot enter `pilot` while a required gate is pending or failed. Passing every gate still does not enable external action or autonomous high-impact decision-making.

## Draft retention standard

The initial retention rules are deliberately marked `draft_pending_legal_review`.

They cover:

- permanent decision and precedent memory;
- seven-year relationship and operational memory;
- ten-year grant and compliance memory;
- review frequency;
- archival timing;
- confidentiality; and
- legal-hold support.

General Counsel must approve or revise these rules before they become an HPG retention policy.

## Production database entry points

Read views:

- `agent_os_phase4_dashboard`
- `agent_os_phase4_memory_timeline`
- `agent_os_phase4_decision_register`
- `agent_os_phase4_relationship_history`
- `agent_os_phase4_grant_memory`
- `agent_os_phase4_compliance_history`
- `agent_os_phase4_operational_lessons`
- `agent_os_phase4_precedent_library`
- `agent_os_phase4_source_coverage`
- `agent_os_phase4_validation_results`
- `agent_os_phase4_governance`
- `agent_os_phase4_retention_standard`
- `agent_os_phase4_provenance_archive`
- `agent_os_phase4_memory_events`

Governed RPCs:

- `agent_os_phase4_refresh_sources()`
- `agent_os_phase4_run_validation()`
- `agent_os_phase4_record_memory(...)`
- `agent_os_phase4_verify_memory(...)`
- `agent_os_phase4_record_outcome(...)`
- `agent_os_phase4_link_precedent(...)`
- `agent_os_phase4_resolve_conflict(...)`
- `agent_os_phase4_record_gate_review(...)`
- `agent_os_phase4_search(...)`

## Verification

Run:

```text
scripts/agent-os/verify-phase4.sql
```

The production Supabase migration ledger remains the authoritative record of applied Phase 4 database changes. The repository carries the Workspace interface, operational documentation, retired integration code, and repeatable verification script.
