# Development Grant Tracker Current State

After inspecting the live database, the grant tracker is further along than the first frontend-only scan suggested.

## Existing live grant tables

The live Supabase database already has a production-style grant schema, including:

- `grant_sources`
- `grant_opportunities`
- `grant_applications`
- `grant_alignments`
- `grant_alignment_scores`
- `grant_documents`
- `grant_drafts`
- `grant_saved_searches`

## Meaning

Do not create a separate grant tracker schema.
Do not create a separate Grant Writer Club database.
Do not keep the old Grant-Writer repo as a disconnected tool.

The best direction is to synthesize everything into the existing grants module and existing live grant tables.

## What this branch does

This branch merges the useful intent of the separate Grant-Writer repo into the existing HPG Workspace grant module:

- TypeScript alignment scoring
- demo NGO/grant records
- draft generation
- tracker/draft tabs in the Grants dashboard
- seed data inserted into the existing grant schema

## What should come next

1. Connect STW alignment to live `ngos` and `grant_opportunities` instead of demo arrays.
2. Store alignment results into `grant_alignments` or `grant_alignment_scores`.
3. Store generated proposal drafts into `grant_drafts`.
4. Add a button to create grant-writing work items for Development, Finance, Communications, and NGO Coordination.
5. Add public data ingestion for Grants.gov and USAspending first.
6. Add saved search alerts using `grant_saved_searches`.

## Avoid redundancy

Future grant features should use these existing tables and hooks:

- `useGrantOpportunities`
- `useGrantApplications`
- `grant_sources`
- `grant_opportunities`
- `grant_applications`
- `work_items`
- `documents`

Do not build a second parallel tracker.
