# HPG Supabase historical migration replay — source and safety

## Why the clean database previously failed

HPG has legacy production tables provisioned outside the Git migration chain.
Later committed migrations refer to those objects, so a blank database fails
despite the real production environment still functioning.

- July 17, 2026: \`close_production_security_advisor_errors.sql\` assumes
  \`public.hr_email_outbox\`, \`public.volunteer_applications\`, and
  \`public.pending_hr_volunteer_emails\` exist. \`volunteer_applications\`
  is recreated by a July 10 Agent OS migration but with a different UUID
  identifier from the actual production bigint identifier.
- September 29, 2026: \`workspace_account_approval_notifications.sql\`
  assumes \`public.workspace_admin_notification_events\` already exists,
  including a named notification-kind check constraint.
- The older Supabase CLI statement splitter also misparsed function names
  containing "atomic"; the CI now uses pinned CLI v2.122.1. See upstream
  https://github.com/supabase/cli/issues/5020.

## Approach

The files under \`supabase/fixtures/legacy-replay/\` are **schema-only,
CI-only historical fixtures**, not deployable production migrations. CI
temporarily copies them to \`supabase/migrations\` before running
\`supabase start\` and \`supabase db reset --local\` in a disposable,
empty Postgres instance.

Their original objects, column types, defaults, constraints, indexes, RLS
state and view definition were inspected directly from the connected HPG
database on November 8, 2026. No personal data, applicants, credentials,
email content, notification messages or staff records were copied.

The volunteer fixture includes a bigint application identifier and matching
bigint HR email foreign key, consistent with the live system. The notification
fixture has a UUID key, unique deduplication key, retry-lease columns, and
the required named kind/status constraints. Existing original migrations may
then evolve these definitions in their documented order.

Historical migrations already applied to production are preserved unchanged
byte-for-byte. CI injection leaves the checked-in production migration list
unmodified. No migration is applied to the live database by this repair.

## What a successful CI run proves

1. An empty local environment has the formerly missing production-origin
   schema objects prior to the historical migrations that require them.
2. The entire remaining migration list applies in order against that setup.
3. Re-running local \`db reset\` succeeds, not just the initial start.
4. Existing privacy, security, editorial, Academy and agent tests pass.
5. The original HR outbox and workspace notification tables have RLS,
   uniqueness/FK constraints, and no invented mail or notification rows.

## What it does not prove

It is **not** a complete forensic copy of all original production DDL.
Production may have additional triggers, grants, policies, columns, historical
DDL, or data migrations not represented in source control. The CI fixture
captures the schema dependencies that must exist before the recorded migrations
and provides an explicit, reviewable provenance rather than pretending the
legacy database was built solely from migrations.

A separate metadata parity comparison of the full live and local schemas is
necessary before claiming that the entire HPG database can be recreated
identically from Git alone. The live project and its production migration
history are not reset, replaced or modified here.

## Maintenance rule

When new missing historical objects are discovered, inspect the live catalog
and add a separate dated fixture only after documenting source types,
constraints, ownership, RLS and the relevant dependent migration. Never
create fictional users or records to make tests pass; never make an
unreviewed security-definer shortcut or weaken RLS to silence a test.

Related tracking: https://github.com/gilbertfoust/hpg-workspace/issues/150.
