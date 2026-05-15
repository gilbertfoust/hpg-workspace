# Supabase RLS Hardening Plan

## Purpose

This document gives HPG a safe path for hardening Supabase Row Level Security without breaking the existing HPG Workspace.

During the HPG Assistant build, Supabase reported that `public.profiles` and `public.ngos` had RLS disabled. These tables are central to the app. Enabling RLS without tested policies could lock users out or break dashboards, so this plan should be reviewed before applying migrations.

## Current Risk

Tables requiring review:

| Table | Risk | Why It Matters |
|---|---|---|
| `public.profiles` | High | Contains user identity, role, and staff profile context. |
| `public.ngos` | High | Contains NGO records used by onboarding, finance, development, compliance, and the Assistant. |

## Guiding Principle

Do not enable RLS first and write policies later. Write and test policies in a branch/migration plan first, then enable RLS after access has been confirmed.

## Minimum Role Model To Confirm

Before applying RLS, confirm the production meaning of these roles:

- `super_admin`
- `admin_pm`
- `ngo_coordinator`
- `department_lead`
- `staff`
- `executive_secretariat`
- `external_portal`

## Suggested Access Rules

### `profiles`

Recommended baseline:

- Users can read their own profile.
- `super_admin` and `admin_pm` can read all profiles.
- Department leads can read profiles assigned to their department if that relationship exists in schema.
- Users can update only limited fields on their own profile.
- Role changes should be restricted to `super_admin` or an approved admin flow.

### `ngos`

Recommended baseline:

- `super_admin`, `admin_pm`, and executive roles can read all NGOs.
- `ngo_coordinator` can read assigned NGOs or all NGOs, depending on HPG's operating model.
- Department leads can read NGOs connected to their work items, department assignments, or portfolio.
- `external_portal` can read only the NGO linked to their portal identity.
- Updates to NGO status, fiscal type, and legal/financial fields should be restricted.

## Pre-Migration Discovery Queries

Run these before writing final RLS policies:

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
order by table_name;
```

```sql
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name in ('profiles', 'ngos')
order by table_name, ordinal_position;
```

```sql
select distinct role from public.profiles order by role;
```

```sql
select count(*) as profile_count from public.profiles;
select count(*) as ngo_count from public.ngos;
```

## Safe Implementation Sequence

1. Inventory columns and existing role values.
2. Confirm the role matrix with leadership and technical owners.
3. Create helper functions if needed, such as `is_super_admin()`.
4. Write SELECT policies first.
5. Test SELECT policies using representative users.
6. Write INSERT/UPDATE policies only after SELECT policies pass.
7. Enable RLS in a controlled migration.
8. Test dashboard, Assistant, NGO Coordination, Work Items, Finance, and Admin pages.
9. Monitor Supabase logs for denied queries.

## Do Not Apply Blindly

Do not run a migration that simply says:

```sql
alter table public.profiles enable row level security;
alter table public.ngos enable row level security;
```

without policies in place. That may break authenticated access.

## Draft Policy Concepts

These are conceptual only and should be adapted after schema verification.

```sql
-- Example helper concept only
create or replace function public.is_super_admin()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role in ('super_admin', 'admin_pm')
  );
$$;
```

```sql
-- Example own-profile read concept only
create policy "users can read own profile"
on public.profiles
for select
to authenticated
using (id = auth.uid());
```

```sql
-- Example admin profile read concept only
create policy "admins can read profiles"
on public.profiles
for select
to authenticated
using (public.is_super_admin());
```

## Test Checklist

After applying RLS in a staging or controlled environment, test:

- [ ] User can sign in.
- [ ] Dashboard loads.
- [ ] Sidebar role display works.
- [ ] NGO list loads.
- [ ] NGO detail page loads.
- [ ] HPG Assistant loads.
- [ ] Assistant can generate packets.
- [ ] Assistant can save packets.
- [ ] Assistant can read packet history.
- [ ] Work Items page loads.
- [ ] Finance pages still load for authorized users.
- [ ] Admin pages remain restricted.
- [ ] External portal users cannot see unrelated NGOs.

## Recommended Next Step

Create a separate branch for RLS discovery queries and policy drafting after the role matrix is confirmed. Do not merge RLS enforcement until it has been tested with real user roles.
