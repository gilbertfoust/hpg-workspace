

# Plan: Implement FSA Onboarding & Recruitment Checklists

## Summary

Replace the current simplified pipelines with the exact gate-based FSA onboarding workflow and 13-stage recruitment ATS from the Trello checklists you provided. Add interactive checklist tracking to work items.

---

## Part 1: Database Migrations

### 1a. Add `checklist_json` column to `work_items`

```sql
ALTER TABLE work_items ADD COLUMN checklist_json jsonb DEFAULT NULL;
```

Stores an array of `{"label": "...", "checked": false}` objects per work item. This powers the interactive checklists in the drawer.

### 1b. Expand `applicants` table

Add columns for the Xenia template fields:
- `title_considered`, `department`, `manager` (text)
- `is_otp` (boolean default false)
- `hours_committing`, `time_commitment`, `availability_schedule`, `best_interview_times` (text)
- `potential_start_date` (date)
- `personal_email`, `location_timezone`, `departmental_assessment` (text)

### 1c. Update `validate_applicant_stage()` trigger

Replace the current 6-stage validation with the 14 Trello stages:
`Newly Received`, `HR Screening`, `Dept Head Approval`, `Rejected by Dept`, `Send Interview Request`, `Interview Request Sent`, `Interview Times Received`, `Interview Confirmation`, `Interview Scheduled`, `Interview Completed`, `Dept Decision Made`, `Onboarding Email Sent`, `Materials Received`, `Sent to IT`

Keep backward compatibility with old values (`Applied`, `Screening`, `Interviewing`, `Offer`, `Hired`, `Rejected`).

---

## Part 2: NGO Onboarding Pipeline — FSA Gates

**File**: `src/pages/NGOOnboardingPipeline.tsx`

Replace the 8 generic stages with the exact FSA gate structure from the Trello checklist:

```text
G1 - Intake          → Application meeting intake checklist (11 items)
G1 - Documentation   → Documentation request & collection (12 items)
G2 - Compliance      → Background checks, sanctions, conflict of interest (5 items)
G2 - Program Review  → Program fit + internal approval (2 items)
G2 - General Counsel → Eligibility, decision, contract development (4 items)
G2 - BOD Approval    → Board notification, soft approval, vote (4 items)
G2 - Finance         → Fee confirmation, billing, payment, release (7 items)
G3 - Contract Exec   → Send/receive/confirm signed contract (4 items)
Dept Onboarding      → IT, HR, Marketing, Development, Operations setup
Active                → Monitoring & reporting
```

Each gate becomes a Kanban column. The "Launch Onboarding" button creates one work item per gate, each with `checklist_json` populated with the exact checklist items from the Trello cards above.

The `stageForNgo` function will derive position based on which gate's work items are complete.

### Updated `ONBOARDING_WORK_ITEMS` (with checklists)

Each work item gets a `checklist_json` array matching the Trello checklists verbatim. For example, the "G2 - Compliance" work item gets:
```json
[
  {"label": "Mission alignment", "checked": false},
  {"label": "Background checks", "checked": false},
  {"label": "Sanctions screening", "checked": false},
  {"label": "National Alignment Research / Federal Backlists", "checked": false},
  {"label": "Conflict of Interest Analysis", "checked": false}
]
```

---

## Part 3: Work Item Drawer — Interactive Checklists

**File**: `src/components/work-items/WorkItemDrawer.tsx`

Add a "Checklist" section that:
1. Reads `checklist_json` from the work item
2. Renders each item as a checkbox with label
3. Shows progress bar (e.g., "3/5 complete")
4. Toggling a checkbox calls `useUpdateWorkItem` to persist the change
5. Auto-marks work item as "complete" when all checklist items are checked (with confirmation)

---

## Part 4: Recruitment ATS Kanban

### 4a. Update types — `src/hooks/useHRApplicants.ts`

- Change `ApplicantStage` to include all 14 Trello stages (plus legacy values)
- Add Xenia template fields to `Applicant` and `CreateApplicantInput` interfaces
- Update `onboardingWorkItems` to trigger from `Sent to IT` stage instead of `Hired`

### 4b. Rewrite `src/components/hr/HRApplicantsSection.tsx`

Replace the table view with a horizontal Kanban board matching the Trello columns:

```text
Newly Received → HR Screening → Dept Head Approval → Send Interview Request →
Interview Request Sent → Interview Times Received → Interview Confirmation →
Interview Scheduled → Interview Completed → Dept Decision Made →
Onboarding Email Sent → Materials Received → Sent to IT
```

Plus a "Rejected by Dept" column. Cards show applicant name, role, and department. Clicking opens the drawer.

### 4c. Update `src/components/hr/ApplicantDrawer.tsx`

Add the Xenia template fields (hours committing, OTP status, timezone, availability, department assessment) as editable form fields.

---

## Part 5: Edge Functions for External Intake

### 5a. `supabase/functions/receive-sponsorship-application/index.ts`

Public endpoint (`verify_jwt = false`) that:
1. Validates incoming NGO application fields with Zod
2. Creates an `ngos` record (status: `prospect`)
3. Creates a contact record for the primary contact
4. Creates an initial "G1 - Intake" work item with the full intake checklist
5. If budget data included, creates a Finance work item for onboarding fee (10% admin fee)
6. Returns the new NGO ID

### 5b. `supabase/functions/receive-volunteer-application/index.ts`

Public endpoint that:
1. Creates an `applicants` record (stage: `Newly Received`) with Xenia template fields populated
2. Creates an HR work item for screening
3. Returns the new applicant ID

Both include CORS headers and Zod validation.

---

## Part 6: Form Template Seeding

Insert the following into `form_templates`:
- **FSA Application Form** — fields matching the G1 documentation checklist (EIN, AOI, 501c3 letter, etc.)
- **Volunteer Application Form** — fields matching the Xenia template

---

## Execution Order

1. Database migrations (Parts 1a, 1b, 1c) — must go first
2. Work Item Drawer checklist UI (Part 3) — independent
3. NGO Pipeline rewrite (Part 2) — depends on migration
4. ATS Kanban rewrite (Part 4) — depends on migration
5. Edge functions (Part 5) — independent
6. Form template seeding (Part 6) — independent

