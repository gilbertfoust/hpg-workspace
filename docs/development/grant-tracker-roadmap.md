# Development Grant Tracker Roadmap

## Current foundation

The grant tracker foundation now exists in the main app through:

- Grants dashboard
- Grant search
- Grant pipeline
- Grant profile
- Grant STW scoring and draft utilities
- production Supabase tables for sources, opportunities, applications, alignments, drafts, documents, and saved searches

## Do not duplicate

Do not create another standalone grant tracker. Continue building inside:

- `src/modules/grants`
- `grant_sources`
- `grant_opportunities`
- `grant_applications`
- `grant_alignments`
- `grant_drafts`
- `grant_documents`
- `work_items`
- `documents`

## Next PR sequence

### PR 1: Live NGO and opportunity matching

Replace demo-only matching with live NGO profiles and live grant opportunities.

Expected behavior:

- load NGOs from `ngos`
- load opportunities from `grant_opportunities`
- score each opportunity against each NGO
- save results into `grant_alignments`
- display saved alignment scores in the tracker

### PR 2: Create grant-writing work items from matches

For any strong match, allow Development to create a grant-writing work item packet.

Expected work item routing:

- Development: demographics, statistics, grant research, program fit
- Finance: budget and financial section
- Communications: LOI, mission, vision, narrative polish
- NGO Coordination: missing NGO documents and questionnaire follow-up

### PR 3: Draft persistence

Save generated proposal drafts into `grant_drafts` and link them to grant applications.

### PR 4: Public source ingestion

Add source ingestion jobs/functions for:

- Grants.gov
- USAspending.gov award history
- Manual/private foundation entry

### PR 5: Saved searches and alerts

Use `grant_saved_searches` to track recurring searches and notify Development about new opportunities.

## Long-term target

The final Development grant system should act like a GrantStation-style tracker, but with HPG-specific workflow advantages:

- NGO-specific fit scoring
- fiscal sponsorship compliance readiness
- grant writing department task split
- Finance/Development/Communications collaboration
- document packet tracking
- proposal drafting
- award/reporting archive
