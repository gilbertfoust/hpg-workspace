

# Plan: Address All Outstanding Workstation Issues

## Summary
Six concrete workstreams to close every gap identified in the audit: live calendar, in-app notifications, PDF export, policy seeding, admin consolidation, and Google Auth.

---

## Phase 1 — Calendar: Replace Mock Data with Live Work Items

**Problem**: `CalendarPage.tsx` uses hardcoded `mockEvents`. The NGO-scoped calendar (`NGOCalendarTab`) already queries real data — the global page does not.

**Work**:
- Rewrite `CalendarPage.tsx` to query `work_items` (due_date not null) via `useWorkItems`, same pattern as `NGOCalendarTab`.
- Highlight dates with tasks; show overdue items in red.
- Sidebar shows items for the selected date with priority badges, NGO name, and status.
- Add an "Upcoming 14 days" section from the same live query.

**Files**: `src/pages/CalendarPage.tsx`

---

## Phase 2 — In-App Notification Bell (Already Wired, Needs Auto-Scheduling)

**Problem**: The bell icon and reminder popover exist in `MainLayout.tsx` and the hooks work, but no reminders are ever created automatically — the `reminders` table has 0 rows.

**Work**:
- In `useCreateFormSubmission` and `CreateWorkItemDialog`, after a work item with a `due_date` is created, call `scheduleDefaultReminderForWorkItem()` (already exported from `src/lib/reminders.ts`) to auto-insert a reminder 3 days before the due date.
- Same for `useWorkItems` update mutations — if `due_date` changes, upsert the reminder.

**Files**: `src/hooks/useFormSubmissions.ts`, `src/components/work-items/CreateWorkItemDialog.tsx`, `src/hooks/useWorkItems.ts`

---

## Phase 3 — Financial PDF Export

**Problem**: `financialPdfExport.ts` only does browser `window.print()`. No real PDF generation or storage.

**Work**:
- Keep `printElement` as-is (it works for browser print-to-PDF).
- Add a `downloadTableAsPdf()` helper that renders a provided HTML string into a downloadable file using the browser print API with auto-triggered `print()` and proper styling.
- Add "Download PDF" buttons to Balance Sheet, P&L, Trial Balance, and Cash Flow pages that call this helper.
- After download, optionally save a copy to `ngo-documents` bucket as an archived report.

**Files**: `src/utils/financialPdfExport.ts`, `src/pages/BalanceSheetPage.tsx`, `src/pages/ProfitAndLoss.tsx`, `src/pages/TrialBalancePage.tsx`, `src/pages/CashFlowStatement.tsx`

---

## Phase 4 — Seed Policy Registry with HPG Policies

**Problem**: The `policy_registry` table is empty. The UI works but shows nothing.

**Work**:
- Run a database migration to insert ~15 seed policies based on the Confluence-sourced SOP categories (Governance & Oversight, Financial & Programmatic, Operational Controls, HR & Compliance, IT & Security, etc.) with realistic review dates and "active" status.

**Files**: Database migration only (no code changes).

---

## Phase 5 — Consolidate Admin Pages

**Problem**: `/admin` and `/admin/config` are two separate pages with overlapping functionality. Users get confused.

**Work**:
- Move the Config Check panel from `Admin.tsx` into `AdminConfigHome.tsx` as a new "System" tab.
- Update sidebar navigation to point the Admin link to `/admin/config` instead of `/admin`.
- Keep `/admin` route working as a redirect to `/admin/config`.

**Files**: `src/pages/AdminConfig/AdminConfigHome.tsx`, `src/components/layout/AppSidebar.tsx`, `src/App.tsx`

---

## Phase 6 — Google Auth

**Problem**: Only email/password login is implemented. Google sign-in is not configured.

**Work**:
- Use the Lovable Cloud managed Google OAuth (no external setup needed).
- Run the Configure Social Auth tool to generate the lovable module.
- Update `Auth.tsx` to add a "Sign in with Google" button using `lovable.auth.signInWithOAuth("google", ...)`.
- Remove the old GitHub OAuth code path from `AuthContext.tsx`.

**Files**: `src/pages/Auth.tsx`, `src/contexts/AuthContext.tsx`

---

## Execution Order

Phases 1-4 can be done in parallel (independent files). Phase 5 depends on verifying the current sidebar config. Phase 6 requires the Configure Social Auth tool.

**No new database tables needed** — all tables already exist. Phase 4 is a seed-data migration only.

