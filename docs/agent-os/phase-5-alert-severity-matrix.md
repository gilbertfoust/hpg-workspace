# Phase 5 Alert Severity and Escalation Matrix

## Purpose

This matrix defines how Agent OS Phase 5 classifies and routes monitoring conditions. It is an operating control, not a transfer of authority from HPG's human decision-makers.

## Severity matrix

| Severity | Rank | Meaning | Default response | Default escalation | Acknowledgement | Executive visibility |
|---|---:|---|---:|---:|---|---|
| Informational | 1 | Awareness only | 24 hours | 7 days | No | No |
| Watch | 2 | Observation or preparation required | 24 hours | 72 hours | No | No |
| Action Required | 3 | Documented operating response required | 8 hours | 24 hours | Yes | No |
| High Risk | 4 | Material exposure requiring management review | 2 hours | 8 hours | Yes | Yes |
| Critical | 5 | Urgent exposure to compliance, funds, governance, safety, or continuity | 30 minutes | 2 hours | Yes | Yes |

## Category ownership

| Category | Primary Agent OS owners | Accountable human authority |
|---|---|---|
| Compliance | Risk Identification, Legal Oversight, and Compliance Review; Monitoring and Evaluation | General Counsel, Compliance, and Program leadership |
| Financial | Finance Department Agent; Controller Evidence and Performance | Vice President, Finance or authorized Finance officer |
| Grant | Grant Management; Grant Writing and Grant Acquisition | Development and Grant Management leadership |
| Governance | Ethics, Policy Frameworks, Governance Support; Board Nominations and Development | Board, General Counsel, Governance, and executive authorities |
| Operational | Operations Guidelines and Routing; Monitoring and Evaluation; Volunteer Onboarding | Operations, Program, Human Resources, and departmental leadership |

## Escalation principles

1. The initial alert remains owned by the rule's Agent OS identity and accountable human role.
2. A response deadline determines when acknowledgement or action should be recorded.
3. An escalation deadline determines when an unresolved alert creates an internal escalation record.
4. Escalation does not send external communication.
5. Escalation does not alter the authoritative source record.
6. Critical and High Risk alerts receive executive visibility, but the system does not make the executive decision.
7. A resolved alert requires evidence or a documented signal-cleared explanation.
8. A dismissal requires management authority and written reasoning.
9. A snooze creates a time-bounded suppression; it does not erase the alert or signal.
10. Repeated detection increments occurrence history rather than generating duplicate alerts.

## False-positive controls

Phase 5 limits alert volume through:

- active-alert fingerprint uniqueness;
- source-record, entity, module, owner, NGO, or global aggregation;
- rule-specific duplicate-suppression windows;
- authorized suppression records;
- auto-resolution after consecutive clear scans;
- management dismissal with audit reason; and
- Efficiency quality assurance before pilot authorization.

## Human review status

The severity matrix and thresholds remain subject to the eight Phase 5 human governance gates. Passing automated validation confirms internal consistency and technical behavior; it does not constitute departmental, legal, financial, Board, or executive approval.
