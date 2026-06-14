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

## Resulting workflow

Development → Grants now supports:

1. Seek opportunities
2. Score NGO/grant alignment
3. Track best matches
4. Generate proposal draft text for grant writers

## Next enhancement

A future PR should connect these demo objects to live Supabase grant opportunities and actual NGO profiles, then allow high-scoring matches to create grant-writing work items assigned to Development, Communications, and Finance.
