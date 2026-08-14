# Trello Integration Retirement and Historical Provenance

Status: **retired by Agent OS Phase 4**.

HPG Workspace and its connected Supabase database are the authoritative operating system for work items, cases, assignments, boards, approvals, handoffs, institutional memory, and audit history.

Trello is no longer permitted to create, update, assign, move, archive, approve, or synchronize an HPG operational record.

## Current operating role

```text
Provider: Trello
Operating role: historical_provenance_only
Authoritative: false
Inbound mutation allowed: false
Outbound mutation allowed: false
Status: retired
Replacement: HPG Workspace / Supabase
```

Historical Trello identifiers, URLs, board references, list references, and snapshots remain available in the Phase 4 provenance archive. This preserves traceability without maintaining a competing system of record.

## Retired execution paths

Phase 4 retired each operational Trello path:

- the `work_items` outbound synchronization triggers were dropped;
- `work_items.trello_sync` is constrained to `false`;
- all Trello route mappings are inactive;
- all Trello member mappings are inactive;
- pending and processing synchronization rows are prohibited;
- the queue trigger function is no longer executable by browser roles;
- the Trello webhook edge function returns HTTP `410 Gone` and performs no reads or writes;
- the Trello synchronization worker returns HTTP `410 Gone`, reports zero eligible and processed records, and performs no external request;
- historical Trello references were copied into `external_system_provenance_archive` with SHA-256 snapshot hashes.

## Historical provenance retained

The archive preserves legacy references from:

- grant Trello cards;
- grant applications;
- grant opportunities;
- Partnership/FSA board references;
- work items;
- permanent Agent OS cases; and
- NGO ES-FSA card references.

Every archived record is explicitly marked non-authoritative.

## Safety rule

No credential, environment variable, route mapping, queue insertion, webhook delivery, or worker invocation can reactivate Trello operations. Reactivation would require a later governed migration that deliberately removes the Phase 4 database constraints, restores execution code, passes security validation, and receives the required human approvals.

## Phase 4 verification

Run:

```text
scripts/agent-os/verify-phase4.sql
```

The script verifies that:

1. Trello remains retired and provenance-only;
2. webhook and worker tombstones are attested;
3. no active route or member mappings exist;
4. no pending or processing synchronization rows exist;
5. no work item has Trello synchronization enabled;
6. no outbound synchronization trigger remains attached; and
7. historical provenance remains searchable in the HPG Workspace.
