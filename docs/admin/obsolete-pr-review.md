# Obsolete PR Cleanup and Rebuild Notes

This note records the decision made after reviewing the remaining conflicted PRs in the repository.

## Closed as obsolete

The following PRs were closed instead of force-merged because they were created before the current NGO portal, document upload, workflow routing, department form upload, and work-item archive model existed.

- #13 — old Documents Center implementation
- #15 — old Admin Roles and Departments implementation
- #19 — old Admin Quick Start seed-data implementation
- #29 — conflict-fix branch for #13
- #30 — conflict-fix branch for #15
- #31 — conflict-fix branch for #19
- #65 — older compliance-only NGO portal direction, superseded by the newer NGO request intake portal

## Useful ideas preserved

These old branches had useful ideas, but they must be rebuilt on top of current `main` so they do not overwrite newer work.

### 1. Admin access model

Preserved now in code through normalized role groups:

- NGO portal roles: `ngo_user`, `external_ngo`
- Admin roles: `super_admin`, `admin_pm`
- VP roles: `vp_operations`, `vp_programs`, `vp_development`, `vp_finance`, `vp_communications`
- Department leadership roles: `ngo_coordinator`, `department_lead`, `executive_secretariat`
- Staff workspace roles: all internal staff, department, VP, and admin roles

### 2. Modern Documents Center

Should be rebuilt later as a fresh PR using the current `documents`, `ngo-documents`, NGO portal upload, NGO card upload, department-form upload, and completed-work-item archive model.

Recommended features:

- filter by NGO, department, form template, work item, category, review status, and upload date
- review queue for staff
- view/download links
- evidence status integration with work items
- compliance-document visibility for NGO portal users only within their linked NGO

### 3. Admin Quick Start

Should be rebuilt later as a fresh admin-only utility, not merged from the old branch.

Recommended features:

- seed sample NGOs only in development/demo environments
- create sample NGO portal users
- create sample request forms and compliance periods
- create sample work items by department
- prevent duplicate seed records

## Reason for cleanup

The old conflicted PRs were no longer safe to merge. Several modified the same files that now contain newer production-direction logic, especially:

- `src/pages/Portal.tsx`
- `src/hooks/useDocuments.ts`
- `src/pages/Documents.tsx`
- `src/components/ngo/DocumentUploadDialog.tsx`
- `src/components/ngo/NGODocumentsTab.tsx`
- `src/components/work-items/WorkItemDrawer.tsx`
- `src/App.tsx`
- `src/components/layout/AppSidebar.tsx`
- `src/hooks/useUserRole.ts`

Future improvements should be rebuilt in small, current-main PRs.
