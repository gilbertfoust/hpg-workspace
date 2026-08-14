# Agent OS Phase 5 — Production Migration Ledger

The connected HPG Supabase migration history is the authoritative record of applied Phase 5 database changes.

The following Phase 5 migrations were applied successfully on August 14, 2026:

1. `agent_os_phase5_monitoring_core`
2. `agent_os_phase5_monitoring_runtime_helpers`
3. `agent_os_phase5_compliance_candidates`
4. `agent_os_phase5_financial_candidates`
5. `agent_os_phase5_grant_candidates`
6. `agent_os_phase5_governance_candidates`
7. `agent_os_phase5_operational_candidates`
8. `agent_os_phase5_operational_candidate_aggregation`
9. `agent_os_phase5_candidate_union`
10. `agent_os_phase5_source_markers`
11. `agent_os_phase5_scan_runtime`
12. `agent_os_phase5_schedule`
13. `agent_os_phase5_validation_governance`
14. `agent_os_phase5_dashboard_alert_views`
15. `agent_os_phase5_monitoring_support_views`

## Migration responsibilities

### `agent_os_phase5_monitoring_core`

Creates the Phase 5 program, severity, threshold, source, rule, run, alert, signal, event, suppression, escalation, scenario, validation, assertion, and governance structures. It also establishes RLS, direct-write denial, the five-level severity matrix, fourteen draft thresholds, twenty-one source adapters, thirty-one monitoring rules, eight validation scenarios, and twenty-four governance gates.

### `agent_os_phase5_monitoring_runtime_helpers`

Creates SHA-256 evidence and alert fingerprints, alert references, deadline-severity calculation, hash-chained alert events, idempotent signal emission, duplicate detection, suppression matching, reopening, missed-run auto-resolution, internal escalation, and governed acknowledge, snooze, resolve, and dismiss operations.

### Candidate evaluator migrations

The five category-specific evaluator migrations create read-only signal candidates for:

- compliance;
- financial controls;
- grants;
- governance; and
- operations.

The operational aggregation migration replaces source-record alert floods with module-level summaries for overdue and due-soon unowned work.

### `agent_os_phase5_candidate_union`

Combines the five category evaluators into one controlled candidate stream for production scans.

### `agent_os_phase5_source_markers`

Creates source row-count helpers and before-and-after authoritative-source markers. These markers confirm that scanning and validation do not alter the operational records being monitored.

### `agent_os_phase5_scan_runtime`

Creates the protected production scan engine, advisory concurrency lock, candidate evaluation, signal and alert persistence, deduplication, suppression, auto-resolution, internal escalation, source-coverage refresh, scan metrics, and Agent OS audit events.

### `agent_os_phase5_schedule`

Installs `pg_cron`, creates a protected scheduled-scan function, and registers:

```text
agent-os-phase5-scan-15m
*/15 * * * *
select agent_runtime.phase5_run_scheduled_scan();
```

The scheduled function is unavailable to authenticated browser roles.

### `agent_os_phase5_validation_governance`

Creates the eight-scenario validation suite, twenty-nine assertions, sixteen automated and security gates, eight evidence-required human review work items, and the governed human gate-review RPC.

### View migrations

The dashboard and support-view migrations create the twelve SECURITY INVOKER views used by the Phase 5 Workspace control center.

## Production execution evidence

The following production behavior was verified:

- bootstrap scan created sixteen alerts from sixteen signals;
- second scan created zero alerts and deduplicated all sixteen signals;
- Phase 5 governance work created one additional governance alert;
- the protected cron schedule completed successfully;
- the next scheduled scan evaluated seventeen signals and deduplicated all seventeen;
- latest scan external side effects: zero;
- latest scan authoritative source mutations: zero;
- latest validation source fingerprint: unchanged;
- alert lifecycle rollback test passed acknowledgement, suppression, resolution, dismissal, evidence, and hash-chain controls.

## Verification

Run:

```text
scripts/agent-os/verify-phase5.sql
```

The verification script checks the live schema, source coverage, severity matrix, rule library, validation assertions, governance work items, alert hashes, event chains, schedule execution, deduplication evidence, RLS, invoker-security views, RPC exposure, and zero-external-action boundary.
