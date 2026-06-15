# NGO Portfolio Status Dashboard Chart

This dashboard phase adds a second pie chart next to the work item status distribution.

## Purpose

The chart shows where every NGO relationship currently sits in the HPG portfolio/pipeline.

## Portfolio buckets

- Applicants
- Under Review
- Processing
- Onboarding
- Static State
- Out of Compliance
- Exit Process

## Status mapping

The dashboard maps existing and future NGO status values into these operational buckets. Examples:

- `prospect`, `applicant`, `application` -> Applicants
- `under_review`, `due_diligence`, `screening` -> Under Review
- `processing`, `pending`, `submitted` -> Processing
- `onboarding` -> Onboarding
- `active`, `good_standing`, `compliant` -> Static State
- `at_risk`, `out_of_compliance`, `non_compliant`, `remediation` -> Out of Compliance
- `offboarding`, `closed`, `exit_process`, `inactive` -> Exit Process

## Dashboard value

This turns the dashboard from static KPI cards into a portfolio command view. Leadership can immediately see how many NGOs are still applicants, in review, onboarding, stable, out of compliance, or exiting.
