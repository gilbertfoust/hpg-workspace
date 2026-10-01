# Agent OS Phase 6 — Production Migration Ledger

The connected HPG Supabase migration history is the authoritative record of applied Phase 6 database changes.

The following migrations were applied successfully on August 14, 2026:

1. `agent_os_phase6_workspace_core`
2. `agent_os_phase6_validation_security`
3. `agent_os_phase6_runtime_helpers`
4. `agent_os_phase6_decision_engine`
5. `agent_os_phase6_refresh_and_actions`
6. `agent_os_phase6_board_and_alert_scope_repair`
7. `agent_os_phase6_capacity_decision_idempotency`
8. `agent_os_phase6_schedule`
9. `agent_os_phase6_validation_helpers_governance`
10. `agent_os_phase6_validation_suite`
11. `agent_os_phase6_views`
12. `agent_os_phase6_public_predicate_boundary`
13. `agent_os_phase6_view_isolation_repair`
14. `agent_os_phase6_gate_evidence_status_cast`
15. `agent_os_phase6_event_clock_ordering`

## Migration responsibilities

### Workspace core

Creates the Phase 6 program, thirteen department profiles, thirteen native agent-work boards, existing-board bindings, refresh runs, assignments, department snapshots, executive briefs, executive decision packets, options, evidence, positions, events, and the Workspace-native cutover record.

It also moves all seventy-seven configured agents to native Workspace routes and sets every Agent OS identity to:

```text
trello_mode = historical_provenance_only
```

### Validation and security

Creates the eight-scenario validation model, validation runs, assertions, twenty-nine governance gates, RLS policies, direct-write denial, CEO and executive reader predicates, and external-persona isolation boundaries.

### Runtime helpers

Creates source hashing, assignment scoring, source markers, assignment refresh, department snapshot calculations, and hash-chained decision-event helpers.

### Decision engine

Creates candidate generation for:

- material Phase 5 alerts;
- critical department capacity;
- grant-action records requiring executive judgment; and
- Agent OS executive governance gates.

It also creates decision options, primary evidence, Phase 4 institutional-memory support or explicit precedent limitations, Noemi and domain-agent positions, and Noemi executive briefs.

### Refresh and actions

Creates the protected command refresh and governed human actions for:

- assignment review;
- CEO review initiation;
- CEO decision recording;
- agent support, concern, or dissent positions; and
- human governance gate review.

### Board and alert-scope repair

Adds the Legal native-board binding and corrects department alert aggregation so a module receives only the relevant operational backlog alerts rather than every operational alert.

### Capacity-decision idempotency

Changes capacity-decision identity from the changing snapshot UUID to the stable department profile key. Repeated refreshes update one active capacity decision rather than creating a new decision for every snapshot.

### Schedule

Registers:

```text
agent-os-phase6-refresh-30m
*/30 * * * *
select agent_runtime.phase6_run_scheduled_refresh();
```

The scheduled function is unavailable to authenticated browser roles.

### Validation helpers and governance

Creates assertion recording, automated-gate updates, eight evidence-required human review work items, and the governed gate-review lifecycle.

### Validation suite

Creates the complete Phase 6 scenario suite and automated-security gate evaluation. The suite verifies assignments, native boards, snapshots, scoring, decision packets, evidence, options, precedent, dissent, CEO authority, RLS, source integrity, and external-persona isolation.

### Views

Creates the fourteen SECURITY INVOKER views used by the Workspace interface.

### Public predicate boundary

Moves security-definer predicate logic into the protected `agent_runtime` schema and makes public predicate wrappers invoker-security functions.

### View isolation repair

Prevents the scalar executive dashboard and native-cutover views from exposing one summary row to an external NGO persona.

### Gate evidence-status cast

Corrects the governance work-item evidence-status update to use the existing `evidence_status` enum explicitly.

### Event clock ordering

Uses `clock_timestamp()` for decision events so multiple lifecycle events created inside one transaction preserve deterministic hash-chain order.

## Production execution evidence

Verified behavior includes:

- all seventy-seven agents routed to native Workspace destinations;
- thirteen department profiles;
- thirteen native agent-work boards;
- thirty-nine active native operating boards and thirty-nine governed bindings;
- zero Trello-synced work items;
- zero active Trello queue items;
- one assignment per active mapped work item;
- repeated refresh with zero duplicate assignments;
- one snapshot per department per refresh;
- stable capacity-decision identity across refreshes;
- one Noemi executive brief per successful refresh;
- protected thirty-minute cron execution;
- eight of eight scenarios passed;
- thirty-two of thirty-two assertions passed;
- twenty-one of twenty-one automated and security gates passed;
- zero external side effects;
- zero authoritative source mutations; and
- unchanged source fingerprints.

## Verification

Run:

```text
scripts/agent-os/verify-phase6.sql
```
