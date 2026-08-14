# Phase 5 Workspace Operating Guide

## Location

The Phase 5 control center appears at the top of the HPG Assistant / NGO Coordination workspace:

```text
/hpg-assistant#phase-5
```

## Alert Queue

Use the filters to narrow by:

- text;
- category;
- severity; and
- status.

Opening an alert displays:

- source condition;
- latest evidence snapshot;
- responsible Agent OS owner;
- accountable human role;
- required response;
- source deadline;
- response deadline;
- escalation deadline;
- signal count;
- audit-event count; and
- evidence hash.

### Acknowledge

Use acknowledgement to record that a human has assumed responsibility for the response. The note should identify the reviewer, immediate action, and expected next step.

### Snooze

Snooze requires management authority, a written reason, and an end time. It creates a suppression record and does not delete the signal.

### Resolve

Resolution requires:

- a summary of the corrective action;
- confirmation or verification performed; and
- an evidence reference.

### Dismiss

Dismissal requires management authority and a written explanation of why the alert is a false positive, duplicate context, or non-actionable condition.

## Rules and Thresholds

This tab displays:

- the five-level severity matrix;
- all thirty-one monitoring rules;
- source ownership;
- responsible human role;
- rule frequency;
- suppression window;
- aggregation mode;
- auto-resolution threshold;
- active and historical alert counts; and
- fourteen draft thresholds.

The thresholds remain pending human review.

## Sources

The Source Coverage tab shows:

- registered source;
- category;
- confidentiality;
- owner agent;
- source row count;
- signal count from the latest scan;
- active alert count;
- coverage status; and
- last scan time.

A category with no current alerts should be interpreted together with source coverage. An empty or incomplete source may explain the absence of a signal.

## Validation

The Validation tab displays the eight required scenarios and twenty-nine assertion results.

A passing validation proves that the controlled implementation behaves as specified. It does not approve the thresholds or authorize production pilot use.

## Governance

Each human gate includes:

- required reviewer;
- review description;
- associated Workspace item;
- due date;
- evidence;
- notes; and
- decision status.

## Scan History

The history shows:

- manual, bootstrap, and scheduled scans;
- rule and signal counts;
- alerts created;
- alerts updated;
- alerts deduplicated;
- alerts suppressed;
- alerts auto-resolved;
- alerts escalated;
- external side effects; and
- authoritative source mutations.

The expected values for external side effects and authoritative source mutations are always zero.

## Suppressions and Escalations

The final tab shows production suppression records and internal escalation records.

Suppression preserves human authorization and time boundaries. Escalation preserves internal routing without sending an external message.
