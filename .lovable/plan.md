

# HR Hub — Gap Analysis & Build Plan

## Current State

The HR module has **6 working pages** and a **functional ATS pipeline**:

| Feature | Status | Depth |
|---------|--------|-------|
| HR Dashboard (KPIs) | Built | Summary cards only, no charts or trends |
| Staff Profiles | Built | List + create dialog. No detail page, no edit form, no documents |
| Timesheets | Built | Create/submit/approve flow. Only total hours — no daily line items |
| PTO Management | Built | Request/approve. No calendar view, no balance auto-deduction |
| Payroll Export | Built | CSV export. No pay period management or pay run history |
| Job Requisitions (ATS) | Built | Full CRUD with audit logging |
| Applicant Pipeline | Built | Stage-grouped table, detail drawer with document upload + interviews |
| Interview Scorecards | Built | Log interviews with rubric scores and recommendations |

**Compare to the Financial Hub**: The Financial Hub has 20+ deeply functional pages (Journal, Ledger, Trial Balance, P&L, Balance Sheet, Cash Flow, Forecasts, Reconciliation, Invoices, Bills, Aging Reports, Tax Liability, Recurring Transactions, Period Comparison). The HR Hub has 6 pages that are functional but shallow.

---

## What Needs to Be Built

### 1. Staff Profile Detail Page
A dedicated `/erp/hr/staff/:staffId` page with:
- Personal info editor (name, email, phone, emergency contact)
- Employment details (title, type, department, NGO, salary/rate, start/end dates)
- Documents tab (contracts, ID copies, tax forms — stored in existing `ngo-documents` bucket)
- Timesheets tab (filtered to this employee)
- PTO history tab
- Notes/activity log
- Status change with termination date support

### 2. Timesheet Line Items
New table `timesheet_entries` to support daily/task-level time tracking:
- staff_id, timesheet_id, entry_date, hours, project/task description, cost_center_id
- The existing Timesheets page becomes a summary; a detail view shows the daily grid
- Auto-sum line items into the timesheet total_hours

### 3. PTO Calendar & Balance Auto-Tracking
- Calendar view showing who's out when (visual grid by week/month)
- Auto-deduct PTO balance when a request is approved
- Auto-restore balance when canceled
- Accrual rules (optional future: monthly accrual rate on staff_profiles)

### 4. Employee Documents Hub
New table `staff_documents`:
- staff_id (FK → staff_profiles), document_type (contract, id_copy, tax_form, certification, other), file_name, storage_path, uploaded_at, expiry_date (nullable)
- Dedicated tab on the Staff Detail page
- Upload and download from `ngo-documents` bucket under `hr/staff/{staffId}/` path

### 5. Onboarding & Offboarding Checklists
New table `hr_checklists`:
- id, ngo_id, checklist_type (onboarding | offboarding), name, items (JSONB array of checklist steps)

New table `hr_checklist_assignments`:
- id, staff_id, checklist_id, status (pending | in_progress | completed), assigned_at, completed_at, item_statuses (JSONB — tracks each item's completion)

- Onboarding page at `/erp/hr/onboarding` showing active onboarding assignments
- When an applicant is marked "Hired", auto-assign the default onboarding checklist
- Offboarding triggered when staff status → terminated

### 6. Performance Reviews
New table `performance_reviews`:
- id, staff_id, ngo_id, reviewer_user_id, review_period_start, review_period_end, status (draft | submitted | acknowledged), overall_rating (1-5), goals_met (JSONB), strengths, areas_for_improvement, reviewer_comments, staff_comments, created_at, updated_at

- Page at `/erp/hr/reviews` — list all reviews, create new review cycles
- Detail view per review with rating scales and narrative fields

### 7. Training & Certifications Tracker
New table `staff_certifications`:
- id, staff_id, certification_name, issuing_body, issue_date, expiry_date, status (active | expired | pending_renewal), document_path, notes

- Section on Staff Detail page
- Dashboard card showing expiring certifications (next 30/60/90 days)

### 8. HR Analytics Dashboard
Upgrade the existing HRModuleDashboard with:
- Headcount over time (line chart)
- Turnover rate (terminated in period / average headcount)
- Headcount by department, by NGO, by employment type (bar/pie charts)
- Average tenure
- PTO utilization rate
- Open requisitions → time-to-fill metrics
- Cost summary (total payroll by NGO/department)

### 9. Pay Run Management
New table `pay_runs`:
- id, ngo_id, pay_period_start, pay_period_end, status (draft | processing | completed), total_gross, total_net, run_date, notes, created_at

New table `pay_run_items`:
- id, pay_run_id, staff_id, regular_hours, overtime_hours, gross_pay, deductions (JSONB), net_pay

- Page at `/erp/hr/payroll/runs` — create pay runs from approved timesheets
- Auto-pull approved timesheet hours for the period
- Calculate gross from salary/hourly rate
- CSV export per pay run (replaces the current flat export)

### 10. Company Directory & Org Chart
- `/erp/hr/directory` — searchable card grid of all active staff with photo placeholder, title, department, contact info
- Simple org chart visualization using department hierarchy from org_units

---

## Navigation Updates

Under **HR & Workforce** in the ERP sidebar, expand to:
- Dashboard (existing)
- Staff Profiles (existing)
- Staff Detail (route only, no sidebar link — accessed from profiles)
- Timesheets (existing, enhanced)
- PTO (existing, enhanced with calendar)
- Onboarding
- Reviews
- Payroll Runs (replaces current Payroll Export)
- Directory
- Analytics

---

## Database Changes (1 migration)

**New tables (7):**
1. `timesheet_entries` — daily time line items
2. `staff_documents` — per-employee document storage
3. `hr_checklists` — onboarding/offboarding templates
4. `hr_checklist_assignments` — assigned checklists per staff
5. `performance_reviews` — review cycles
6. `staff_certifications` — training/cert tracking
7. `pay_runs` + `pay_run_items` — payroll processing

All tables get RLS policies matching the existing `authenticated` user pattern.

---

## Files Summary

**New pages (~10):**
- `StaffProfileDetail.tsx` — full employee profile
- `TimesheetDetail.tsx` — daily entry grid
- `PTOCalendar.tsx` — visual calendar view
- `OnboardingDashboard.tsx` — active onboarding assignments
- `PerformanceReviews.tsx` — review cycles
- `PayRuns.tsx` — pay run management
- `StaffDirectory.tsx` — card grid + simple org chart
- `HRAnalytics.tsx` — charts and workforce metrics

**New hooks (~7):**
- `useTimesheetEntries.ts`
- `useStaffDocuments.ts`
- `useHRChecklists.ts`
- `usePerformanceReviews.ts`
- `useStaffCertifications.ts`
- `usePayRuns.ts`

**Modified files (~4):**
- `AppSidebar.tsx` — expanded HR nav
- `App.tsx` — new routes
- `PTOManagement.tsx` — add calendar view tab
- `Timesheets.tsx` — link to detail entries

---

## Priority Order

1. Staff Profile Detail page (unlocks everything else)
2. Timesheet line items + daily grid
3. PTO calendar + auto-balance
4. Employee documents
5. HR Analytics dashboard
6. Pay run management
7. Onboarding/offboarding checklists
8. Performance reviews
9. Training/certifications
10. Directory/org chart

