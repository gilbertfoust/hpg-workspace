# Grant Tracker Phase 1 Follow-up

PR #73 merged the first Grant STW integration into the Grants dashboard.

This follow-up branch adds the additional consolidation work discovered after inspecting the live Supabase database:

- the live database already had grant tables
- schema was stronger than originally expected
- the correct move is hardening and synthesizing, not creating duplicate tables
- hooks should use production fields and avoid `status = all` filters
- Grant STW demo opportunities should be seeded into the real grant opportunity table

This preserves the existing source of truth:

- `grant_sources`
- `grant_opportunities`
- `grant_applications`
- `grant_alignments`
- `grant_drafts`
- `grant_documents`
- `grant_saved_searches`
