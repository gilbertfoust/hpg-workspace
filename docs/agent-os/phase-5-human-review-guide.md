# Phase 5 Human Review Guide

Phase 5 remains `ready_for_human_review`. This guide identifies the evidence each reviewer should inspect before recording a pass, failure, or authorized waiver.

## 1. Compliance and Legal monitoring review

Review:

- compliance-obligation rules;
- NGO compliance-period rules;
- program reporting rules;
- policy review rules;
- alert confidentiality;
- legal and regulatory terminology;
- response and escalation timing; and
- whether any condition could be misrepresented as a legal determination.

Confirm that Phase 5 only identifies source conditions and does not interpret law, waive an obligation, or decide legal exposure.

## 2. Finance monitoring review

Review:

- journal-balance integrity;
- stale journal threshold;
- expense receipt and review rules;
- budget variance thresholds;
- cash forecast logic;
- recurring transaction logic;
- Controller-alert integration; and
- highly restricted financial access.

Confirm that Phase 5 does not post, reverse, approve, pay, transfer, reconcile, or otherwise alter a financial record.

## 3. Grant and Development monitoring review

Review:

- deadline lead periods;
- LOI and application distinctions;
- application ownership;
- blocker treatment;
- task deadlines;
- award obligations;
- opportunity verification age; and
- grant and funder terminology.

Confirm that an alert cannot submit, withdraw, dismiss, or commit HPG to an application.

## 4. Governance and Board monitoring review

Review:

- Board candidate backlog aggregation;
- policy review deadlines;
- stalled approvals;
- Agent OS governance work-item monitoring;
- executive visibility; and
- Board and governance access boundaries.

Confirm that Phase 5 cannot nominate, elect, vote, approve, reject, or remove a Board member.

## 5. Operations, Program, and Human Resources monitoring review

Review:

- module backlog thresholds;
- unowned due-soon work;
- aggregation by module;
- program risk flags;
- onboarding, training, access, and offboarding tasks;
- owner routing; and
- potential staffing or capacity misinterpretation.

Confirm that Phase 5 does not assign staff, change employment status, grant access, or close operational work automatically.

## 6. Technology validation

Review:

- protected `pg_cron` schedule;
- fifteen-minute cadence;
- advisory concurrency lock;
- failure recovery;
- source markers;
- RLS;
- direct-write denial;
- public RPC security;
- external persona isolation;
- event-chain hashes;
- performance; and
- backup and recovery.

## 7. Efficiency quality assurance

Review:

- false-positive rate;
- duplicate rate;
- aggregation quality;
- suppression use;
- alert relevance;
- owner clarity;
- response burden;
- source-coverage gaps; and
- whether thresholds create unnecessary operational noise.

Efficiency should return any rule that produces an avoidable alert flood or unclear response obligation.

## 8. Executive authorization

Review the complete evidence packet after the seven preceding reviews.

Executive authorization may approve controlled proactive monitoring but does not enable:

```text
automatic work-item creation
external notifications
autonomous remediation
financial execution
legal determinations
employment decisions
Board decisions
```

A separate governed change would be required to enable any additional authority.

## Gate decision requirements

A pass or waiver requires:

- written review notes;
- evidence reference;
- reviewer authority;
- recorded timestamp; and
- completion of the associated Workspace review item.

Only a super administrator may record a waiver. A failed gate pauses the Phase 5 program until the recorded concern is corrected and the gate is reviewed again.
