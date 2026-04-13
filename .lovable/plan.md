

# Fix: Bundles Error and Missing Users Tab on Admin Config Page

## Problems Found

1. **Bundles tab shows error**: The OrgUnitsManager query `select('*, lead:profiles(id, full_name, email)')` fails because there are **two foreign key relationships** between `org_units` and `profiles` (one via `org_units.lead_user_id → profiles.id`, another via `profiles.department_id → org_units.id`). PostgREST cannot auto-resolve the join. This error breaks the Departments tab and may cascade visually.

2. **Users tab missing**: You are on `/admin/config` (AdminConfigHome), which only has Departments, Bundles, and Templates tabs. The Users tab lives on `/admin` (the Admin Console page). These are two separate pages.

## Plan

### 1. Fix the ambiguous FK relationship in OrgUnitsManager
Update the Supabase query in `useAdminConfigOrgUnits.ts` to use an explicit FK hint so PostgREST knows which relationship to follow:

```
.select('*, lead:profiles!fk_org_units_lead(id, full_name, email)')
```

Same fix in the `useCreateOrgUnit` and `useUpdateOrgUnit` mutations that use the same select pattern.

### 2. Add Users tab to AdminConfigHome
Merge the Users management UI into the `/admin/config` page so it's accessible from the same place. Add a "Users" tab as the first tab, either by:
- Importing and rendering the user management table/logic from Admin.tsx directly, or
- Adding a simpler "Users" tab that links to `/admin`

The cleanest approach: extract the user management card from `Admin.tsx` into a reusable component, then render it in both pages. This avoids the confusion of having two separate admin pages.

### Technical Details
- **File changes**: `src/hooks/useAdminConfigOrgUnits.ts` (FK hint fix), `src/pages/AdminConfig/AdminConfigHome.tsx` (add Users tab)
- **No database migration needed** — the FK constraint `fk_org_units_lead` already exists
- The bundles error in the console is a React ref warning on `Select` (cosmetic, not blocking) — the real data error is from the org_units query failing due to the ambiguous relationship

