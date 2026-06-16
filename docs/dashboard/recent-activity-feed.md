# Dashboard Phase 4: Recent Activity Feed

This phase adds a live recent activity feed to the dashboard.

## Purpose

The dashboard should show what just happened across the workspace so leadership and staff can quickly see recent movement.

## Activity sources

The feed pulls from available live tables:

- work items
- documents
- form submissions
- grant opportunities
- grant applications
- NGOs
- audit log

## Behavior

The hook uses safe queries so unavailable tables do not break the entire dashboard. It combines activity from available tables, sorts the records by timestamp, and shows the latest items.

## Dashboard value

After this phase, the dashboard answers:

- What was recently created?
- What was recently uploaded?
- What records recently changed?
- What activity is happening across grants, NGOs, work items, documents, forms, and audit records?

This makes the dashboard feel live rather than static.
