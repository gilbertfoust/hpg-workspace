# Supabase Staging Cost Note

Verified on 2026-07-10 through the connected Supabase account.

- Organization: Humanity Pathways Global
- Organization ID: `twgylowwkbznvhqhpbak`
- Plan: Pro
- Production project: HPG Application Database
- Production project reference: `mlmjlgmsrkemsuwdohsa`
- Region: `us-west-2`
- Project status at verification: `ACTIVE_HEALTHY`
- Development branch cost: `$0.01344 USD per hour`

A development branch must not be created until the account owner confirms understanding of the hourly charge. The branch should be deleted after staging validation and sign-off to stop further hourly billing.

GitHub Actions diagnostic ZIP artifacts are temporary test logs, not database backups or application deliverables. The migration-validation workflow retains them for seven days to diagnose startup, migration replay, smoke-test, lint, and Deno type-check failures.
