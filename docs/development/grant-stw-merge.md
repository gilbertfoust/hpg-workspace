# Grant STW Merge Into Development

This branch merges the useful intent of the separate `gilbertfoust/Grant-Writer` repository into the main HPG Workspace grant module.

## Source repo intent

`Grant-Writer` described HPG Grant STW as a lightweight grant seeker, tracker, and writer for HPG NGOs. Its useful pieces were:

- demo grant opportunities
- demo NGO profiles
- alignment scoring by mission, region, themes, needs, and description overlap
- proposal draft generation
- a pipeline concept: seek, track, write

## Main app integration

The Python CLI was not copied directly into the app because HPG Workspace is a TypeScript/Vite/Supabase application. Instead, the grant logic was converted into TypeScript utilities and merged into the existing grants dashboard.

Added:

- `src/modules/grants/lib/grantStw.ts`
- STW tracker tab inside `src/modules/grants/pages/GrantsDashboard.tsx`
- draft writer tab inside the Grants dashboard
- filters for theme, region match, minimum score, and search text
- generated markdown proposal drafts copied from the Grant-Writer proposal structure

## Production schema consolidation

The live database already had a stronger grant foundation than originally expected. The source of truth is:

- `grant_sources`
- `grant_opportunities`
- `grant_applications`
- `grant_alignments`
- `grant_drafts`
- `grant_documents`
- `grant_saved_searches`

The consolidation migration does not create redundant grant tables. It hardens the existing schema with compatibility columns, indexes, RLS policies, saved searches, and seed sources for future ingestion.

## Live implementation status

Applied live to Supabase:

- hardened existing grant tables
- added compatibility columns for source/funder/eligibility/import data
- created `grant_saved_searches`
- enabled internal-only RLS across the grant tracker tables
- seeded source placeholders for Grant STW Demo Source, Grants.gov, USAspending.gov, and Manual Foundation Research
- seeded the three Grant STW demo opportunities into `grant_opportunities`

Updated in code:

- Grant opportunity hook now handles `all` status correctly
- Grant search shows funder names from production fields
- Grant application hook supports `work_item_id`, `deadline`, and `draft_text`

## Resulting workflow

Development → Grants now supports:

1. Seek opportunities
2. Score NGO/grant alignment
3. Track best matches
4. Generate proposal draft text for grant writers
5. Store opportunities, applications, alignments, drafts, and documents in Supabase

## Next enhancement

A future PR should connect the STW tracker to live NGO profiles and live Supabase grant opportunities, then allow high-scoring matches to create grant-writing work items assigned to Development, Communications, and Finance.

Recommended next workflow:

- Development fills demographics/statistics/research
- Finance fills budget and financial section
- Communications fills LOI, mission, vision, background, and narrative polish
- NGO Coordination requests missing NGO documents or questionnaires
- Admin/records keeps final submission packet and award history
