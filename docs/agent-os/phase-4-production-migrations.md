# Agent OS Phase 4 — Production Migration Ledger

The connected HPG Supabase migration history is the authoritative record of applied Phase 4 database changes.

The following migrations were applied successfully on August 14, 2026:

1. `agent_os_phase4_memory_core`
2. `agent_os_phase4_memory_ingestion`
3. `agent_os_phase4_workspace_authority`
4. `agent_os_phase4_trello_tombstone_attestation`
5. `agent_os_phase4_memory_internal_operations`
6. `agent_os_phase4_memory_public_api`
7. `agent_os_phase4_memory_validation`
8. `agent_os_phase4_memory_views`

## Migration responsibilities

### `agent_os_phase4_memory_core`

Creates the memory, evidence, entity-link, precedent, event, retention, source, ingestion, scenario, validation, assertion, governance, external-authority, and provenance structures. It also establishes RLS, read policies, direct-write denial, the seven source adapters, eight validation scenarios, twenty governance gates, and the Trello retirement record.

### `agent_os_phase4_memory_ingestion`

Creates idempotent source ingestion, source hashing, memory references, event-chain hashing, source evidence, entity links, and historical Trello provenance archival.

### `agent_os_phase4_workspace_authority`

Makes HPG Workspace / Supabase authoritative by removing Trello synchronization triggers, constraining `work_items.trello_sync` to `false`, disabling Trello route and member mappings, and retiring any pending synchronization work.

### `agent_os_phase4_trello_tombstone_attestation`

Records the deployed webhook and worker tombstones, code fingerprints, versions, retirement status, and non-authoritative operating role.

### `agent_os_phase4_memory_internal_operations`

Creates governed memory capture, verification, outcomes, precedent linking, contradictory-fact detection, conflict resolution, supersession, and evidence-required review behavior.

### `agent_os_phase4_memory_public_api`

Creates SECURITY INVOKER Workspace RPC wrappers and full-text institutional-memory search while keeping direct table writes unavailable to browser roles.

### `agent_os_phase4_memory_validation`

Creates the eight-scenario validation suite, assertion records, source-fingerprint comparison, governance work items, automated gate evaluation, and evidence-backed human gate review.

### `agent_os_phase4_memory_views`

Creates the fourteen SECURITY INVOKER read views used by the Phase 4 Workspace control center.

## Verification

The applied migration state is verified through:

```text
scripts/agent-os/verify-phase4.sql
```

The verification script checks the live schema and data state rather than assuming that a migration name alone proves successful deployment.
