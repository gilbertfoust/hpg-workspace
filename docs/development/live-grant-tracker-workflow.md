# Live Development Grant Tracker Workflow

This phase moves the Development grant tracker from demo-only Grant STW logic into the live HPG Workspace data model.

## Source of truth

The live grant tracker should use these tables:

- `grant_sources`
- `grant_opportunities`
- `grant_applications`
- `grant_alignments`
- `grant_drafts`
- `grant_saved_searches`
- `grant_documents`

`grant_alignment_scores` may exist as a backward-compatible table from the first STW pass, but new code should prefer `grant_alignments`.

## Current behavior

The Grants dashboard now:

1. Loads live grant opportunities through `useGrantOpportunities`.
2. Loads live NGO profiles through `useNGOs`.
3. Converts live records into the Grant STW scoring model.
4. Scores NGO/opportunity matches.
5. Keeps demo fallback data only when live data is unavailable.
6. Can generate a draft proposal from a match.
7. Can create a Development work item and grant application record from a match.

## Operational workflow

The intended Development workflow is:

`Grant opportunity → NGO match score → Draft proposal → Create grant-writing work item → Development/Finance/Communications collaboration → Application pipeline → Award/reporting tracking`

## Next implementation step

The next PR should create a deeper route/action that breaks a grant-writing match into multiple departmental work items:

- Development: demographics, research, statistics, need statement
- Finance: project budget, fiscal notes, compliance budget support
- Communications: LOI, mission, vision, organizational background
- NGO Coordination: questionnaire follow-up, missing documents, evidence packet

This will connect grant tracking directly into HPG’s internal work-item engine.
