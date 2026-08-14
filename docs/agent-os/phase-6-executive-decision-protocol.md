# Phase 6 Executive Decision Protocol

## Purpose

The Phase 6 decision queue is an executive judgment system, not an autonomous decision engine.

Its purpose is to ensure that a material issue reaches the Chief Executive with:

- a clear question;
- verified source evidence;
- relevant institutional memory;
- multiple alternatives;
- explicit consequences;
- assumptions and limitations;
- domain-agent positions;
- preserved dissent;
- a recommendation from Noemi Vale;
- a deadline; and
- an auditable human decision record.

## Decision sources

A packet may originate from:

1. a Critical or High Risk Phase 5 alert;
2. a Critical department-capacity snapshot;
3. a grant-action record requiring executive direction;
4. an Agent OS executive governance gate; or
5. a separately governed manual intake added in a future migration.

## Decision lifecycle

```text
source condition
    ↓
queued
    ↓
under_review
    ↓
┌─────────────────────┬──────────────────────────┬──────────────┐
│ decided             │ returned_for_evidence    │ deferred     │
└─────────────────────┴──────────────────────────┴──────────────┘
    ↓
withdrawn or superseded when the source condition clears or is replaced
```

A packet may be withdrawn automatically only when it remains queued and its source condition is absent from the latest refresh. A packet already under CEO review is not silently withdrawn.

## Priority scoring

The executive priority score is a structured operating indicator between zero and one hundred.

It combines source-specific measures such as:

- urgency;
- organizational impact;
- reversibility;
- evidence strength;
- confidence;
- readiness;
- deadline proximity;
- alert severity;
- department capacity;
- department risk; and
- decision pressure.

The score orders the queue. It does not determine the decision.

## Required packet elements

A decision packet should not be considered CEO-ready unless it contains:

- source type;
- source record;
- category;
- decision question;
- current state;
- decision deadline;
- Noemi recommendation;
- recommendation rationale;
- at least two materially distinct options;
- primary source evidence;
- source and packet hashes;
- assumptions;
- dependencies;
- risks;
- expected outcomes;
- evidence-strength score;
- confidence score;
- readiness score;
- accountable human authority; and
- institutional memory or an explicit no-precedent limitation.

## Options

Every option records:

- option key;
- label;
- description;
- recommendation rank;
- whether Noemi recommends it;
- estimated effort;
- estimated timeline;
- benefits;
- risks;
- conditions;
- reversibility; and
- consequence summary.

The decision engine must not provide three labels that represent the same practical action.

## Noemi recommendation

Noemi Vale may:

- synthesize department and specialist evidence;
- rank decision packets;
- recommend one option;
- explain the recommendation;
- identify dependencies and limitations; and
- prepare the executive brief.

Noemi may not:

- begin CEO review;
- record the CEO decision;
- suppress dissent;
- execute the selected option;
- send the decision externally; or
- alter the source operating record.

## Domain-agent positions

A domain agent may record one current position per decision packet:

```text
recommend
support
concern
dissent
abstain
insufficient_evidence
```

The position should include:

- selected option, when applicable;
- summary;
- rationale;
- confidence score;
- evidence references; and
- recording human reviewer.

A dissent position remains visible even when Noemi recommends another option.

## Institutional memory and precedent

Phase 6 searches verified Phase 4 institutional memory for relevant context.

When a record is found, it becomes supporting evidence. It does not mechanically bind the CEO.

When no verified record is found, the packet states that no verified precedent was located and treats the absence as a limitation. The system may not convert the absence of a search result into a conclusion that HPG has never faced a similar situation.

## CEO review

Only the named Chief Executive may invoke the governed review and decision functions.

Beginning review requires written notes. Recording the final decision requires:

- decision code;
- selected packet option;
- decision text;
- rationale;
- conditions;
- evidence reference; and
- authenticated CEO identity.

The source packet remains immutable as evidence. The CEO decision fields and hash-chained events record the human judgment layered on that evidence.

## Decision codes

The interface supports decision codes such as:

- approve;
- approve_with_conditions;
- defer;
- return;
- request_evidence;
- decline; and
- other organization-defined codes.

`defer` produces a deferred packet. `return` and `request_evidence` produce a returned-for-evidence packet. Other complete decision codes close the packet as decided.

## Execution boundary

A recorded CEO decision is not an executed decision.

After the decision is recorded, the accountable human leader must carry out the authorized work through the appropriate source workflow.

Phase 6 does not:

- assign a staff member automatically;
- change the source work-item status;
- send a message;
- submit a grant;
- post a transaction;
- sign an agreement;
- activate an NGO;
- change a policy; or
- make a Board decision.

## Audit chain

Every decision event records:

- event type;
- actor;
- prior state;
- new state;
- evidence;
- prior event hash;
- current event hash; and
- timestamp.

The event lifecycle is tamper-evident and preserves the difference between agent analysis and human authority.
