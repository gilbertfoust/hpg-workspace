# Agent OS Phase 3 — Fiscal Sponsorship Orchestration

## Status

Phase 3 is deployed in the connected HPG production database and exposed in the NGO Coordination workspace at:

```text
/modules/ngo-coordination#phase-3
```

The engineering and automated-control build is complete. The workflow is in `ready_for_human_review` and remains non-authoritative until all required human governance gates are recorded.

## Governing boundary

Phase 3 is a controlled orchestration and evidence layer over the existing Partnership/Fiscal Sponsorship workflow. The authoritative source remains the existing `partnership_fsa_profiles` record and its related agreement, payment, approval, activation, and Program Coordination records.

Phase 3 cannot:

- advance an authoritative NGO stage;
- approve or reject fiscal sponsorship;
- exercise Board authority;
- issue a legal conclusion;
- sign or revise an agreement authoritatively;
- verify a fee or execute a payment;
- send external correspondence;
- issue a confirmation letter;
- activate an NGO; or
- complete the NGO Coordination handoff without human acceptance.

`external_actions_enabled` and `authoritative_mutations_enabled` remain `false`.

## Eleven-stage control path

1. Development Intake
2. Program Fit and Evidence Review
3. Finance Control Review
4. General Counsel Review
5. Executive Packet Review
6. Board Sponsorship Decision
7. Agreement Revision and Approval
8. Finance Fee Clearance
9. Signature and Archive
10. Confirmation and Activation
11. NGO Coordination Handoff

Each stage has a named agent owner, reporting supervisor, department, human authority, required inputs, required outputs, exit criteria, and next-stage rule.

## Production portfolio mapping

All existing Partnership/FSA profiles are registered in shadow mode. Each shadow assignment contains:

- the authoritative profile and NGO identifiers;
- source FSA stage and revision;
- mapped Phase 3 control stage;
- assigned agent and supervisor;
- source snapshot and SHA-256 hash;
- permanent Agent OS case reference; and
- an explicit prohibition on external and authoritative action.

Refreshing the shadow registry is idempotent and does not change `partnership_fsa_profiles`.

## Required validation scenarios

1. Complete happy path
2. Program evidence gap
3. Finance control risk
4. Legal conflict
5. Conditional Board decision
6. Agreement revision mismatch
7. Duplicate provider event
8. NGO Coordination receiver acceptance

The suite validates stage ordering, source lineage, idempotency, revision integrity, human decision boundaries, handoff packet completeness, external-action isolation, authoritative-record integrity, RLS, and direct-write restrictions.

## Evidence model

Every synthetic validation case produces a linked chain:

```text
validation run
  -> permanent case
  -> workflow case
  -> source lineage and source hash
  -> stage runs
  -> generic agent runs
  -> case-stage history
  -> handoff packets and packet hashes
  -> human review requests or internal drafts where required
  -> assertion-level results
  -> audit events
```

The validation suite fingerprints the authoritative sponsorship relations before and after execution. A passing run requires the combined fingerprint to remain unchanged.

## Workspace controls

Authorized super administrators may:

- refresh the shadow registry; and
- run the eight-scenario validation suite.

Authorized reviewers may record a Phase 3 human gate as `passed`, `failed`, or—only for super administrators—`waived`. A pass or waiver requires evidence and written review notes. Review identity and time are preserved in the gate record and audit history.

## Human governance gates

- Development owner review
- Program owner review
- Finance owner review
- General Counsel review
- Executive review
- Board governance review
- Technology validation
- Efficiency quality assurance

The workflow cannot move to `pilot` while any required gate is pending or failed. Even after all gates pass, external and authoritative actions remain disabled until a later production-activation decision.

## Production database entry points

Read views:

- `agent_os_phase3_dashboard`
- `agent_os_phase3_stage_matrix`
- `agent_os_phase3_case_queue`
- `agent_os_phase3_validation_results`
- `agent_os_phase3_human_gates`
- `agent_os_phase3_handoff_evidence`

Governed RPCs:

- `agent_os_phase3_refresh_shadow_assignments()`
- `agent_os_phase3_run_validation()`
- `agent_os_phase3_record_gate_review(...)`

All read views use invoker security. Phase 3 tables use RLS, deny anonymous access, and deny authenticated browser roles direct insert, update, and delete privileges.

## Verification

Run:

```text
scripts/agent-os/verify-phase3.sql
```

The script checks the latest validation, scenario results, governance gates, shadow registry, stage ownership, RLS, direct-write denial, invoker-security views, external-action isolation, and authoritative-fingerprint integrity.
