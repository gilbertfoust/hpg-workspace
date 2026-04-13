

# Confluence-to-Workstation Cross-Reference Analysis

## What Was Found in Confluence

Your Confluence workspace contains SOPs, workflows, forms, and frameworks across 10+ departmental spaces. Here is a summary of the key documents analyzed and how they map to the HPG Workstation.

---

## Gap Analysis: What Confluence Defines vs. What the Workstation Has

### A. FORMS THAT SHOULD BE BUILT AS FORM TEMPLATES

The Confluence pages define these forms that do not yet exist in the workstation's `form_templates` system:

| Form | Source Page | Target Module |
|------|------------|---------------|
| Comprehensive NGO Onboarding & Development Form (11 sections: org profile, governance, HR, curriculum, development, comms, finance, IT, legal, operations, goals) | Program Management Hub | `ngo_coordination` |
| Conflict of Interest Disclosure Form | IRS Compliance Index / Operational Framework | `compliance` or `administration` |
| Gift Acceptance Form | Operational Framework Blueprint | `finance` |
| Restricted Fund Approval Form | Operational Framework Blueprint | `finance` |
| Grant Application Approval Form | Operational Framework Blueprint | `development` |
| Branding Approval Request | Operational Framework Blueprint | `communications` |
| Incident Report Form | Operational Framework Blueprint | `operations` |
| Corrective Action Plan Template | Operational Framework Blueprint | `hr` |
| Termination Checklist | Operational Framework Blueprint | `hr` |
| Data Access Request Form | Operational Framework Blueprint | `it` |
| Country Risk Memo Template | Operational Framework Blueprint | `compliance` |
| Annual Board Disclosure Form | IRS Compliance Index | `compliance` |
| Expense Reimbursement Request | IRS Compliance Index / NGO Orientation | `finance` |
| Volunteer Application / Acknowledgment Form | HR Space | `hr` |
| NGO Orientation Acknowledgment Form | NGO Orientation Training | `ngo_coordination` |
| Whistleblower Report Form | Operational Framework | `compliance` |
| Related-Party Transaction Disclosure | Operational Framework | `finance` |

**Current state**: The workstation has only 2 form templates (`Monthly NGO Check-in` and `Document Request`). This is the largest gap.

---

### B. WORKFLOWS / AUTOMATIONS THAT SHOULD BE BUILT

#### 1. NGO Onboarding Pipeline (19-step workflow from Confluence)
The "Type C Fiscal Sponsorship Onboarding" page defines a 19-step cross-departmental workflow:
- Step 1: Initial Inquiry (Development)
- Step 2: Application Submission (auto-create work items)
- Step 3-4: Program Review + Research
- Step 5: Legal Review
- Step 6-7: Internal Approval + Board Notification
- Step 8: Agreement Signing (e-sign integration)
- Step 9: Interdepartmental Launch Notification (auto-notify all departments)
- Steps 10-18: Department-specific onboarding (Tech, Finance, HR, Marketing, Development, Program, Operations, Monitoring, Reporting)
- Step 19: Archiving

**What exists**: The workstation has NGO creation but no structured onboarding pipeline. Work items exist but there's no workflow engine tying them into a sequenced pipeline.

**What to build**: An "NGO Onboarding Wizard" that auto-generates a set of work items per department when a new NGO is onboarded, with status tracking and a visual pipeline board.

#### 2. Volunteer Applicant Email SOP (6-stage automated flow)
The HR SOP defines triggers and email templates for:
1. Application received → send resume request
2. Info request → send clarification
3. 7-day no response → final follow-up
4. Resume received → schedule interview
5. Interview no-show → follow-up + reschedule
6. Offboarding / decline → closure email

**What exists**: The ATS pipeline exists with stages, but no automated email sending.

**What to build**: Make.com automation triggers (the infrastructure exists) tied to applicant stage changes that send templated emails.

#### 3. Document Lifecycle Workflow (Admin SOP)
- Document created → ES Admin formats/uploads
- Routing notification → Office Management
- Signature via e-sign → track outstanding
- Archive final copy → notify stakeholders
- Deadline monitoring → escalation

**What exists**: E-sign and document modules exist. Missing: automated routing and deadline escalation.

#### 4. Annual Compliance Calendar
The IRS Compliance Template Index and Operational Framework both reference a compliance calendar with filing deadlines, policy reviews, and reporting cycles.

**What to build**: A compliance calendar view within the Compliance module showing filing deadlines, IRS 990 prep dates, state registration renewals, and audit schedules.

---

### C. CONTENT / REFERENCE DATA TO PRE-LOAD

#### 1. IRS Compliance Templates (32 templates)
The IRS Compliance Template Index lists 32 specific templates that should be created as form templates or document templates in the workstation, organized by category:
- Governance & Oversight (8 templates)
- Financial & Programmatic (8 templates)
- Operational Controls (7 templates)
- Policy & Staff Resources (6 templates)
- Advanced Tools (3 templates)

#### 2. Onboarding Checklists
The existing `hr_checklists` table supports this. Pre-load:
- Staff/Volunteer onboarding checklist (from Training Hub: Day 1-5 items, 30-day checklist)
- NGO onboarding checklist (from Type C workflow: 19 steps mapped to checklist items)
- Staff offboarding/termination checklist

#### 3. Policy Index
The Operational Framework Blueprint defines 44 policy sections. These should be loadable as a Policy Registry within the Compliance or General Counsel module — a reference table of policy names, statuses, review dates, and owners.

---

### D. NEW MODULE ENHANCEMENTS

#### 1. NGO Onboarding Pipeline Board
A Kanban-style board (similar to the Development/Partnerships pipeline boards that already exist) showing each NGO moving through onboarding stages: Inquiry → Application → Program Review → Legal Review → Approval → Agreement → Department Onboarding → Active.

#### 2. Compliance Policy Registry
A new page or section in the Compliance module listing all organizational policies with:
- Policy name, category, owner, last review date, next review date, status
- Links to stored documents
- Automated reminders for review deadlines

#### 3. Filing Responsibility Tracker
From the NGO Orientation training, a per-NGO tracker showing:
- Which filings HPG handles vs. which the NGO handles
- Filing type, jurisdiction, deadline, status
- Auto-reminders for upcoming deadlines

#### 4. Donor & Partner Portal Enhancements
The IT "Donor & Partner Microsite" SOP defines features the existing Portal could gain:
- Donation tracking dashboard (donor view)
- Impact report viewer
- Partner proposal submission form

---

## Implementation Plan

### Phase 1: Forms Library (highest impact, most referenced)
Build 15-17 new form templates covering the forms referenced across all Confluence SOPs. These use the existing `form_templates` infrastructure — just new `schema_json` entries.

### Phase 2: NGO Onboarding Pipeline
Add an onboarding pipeline board to the NGO Coordination module. When an NGO is created or a sponsorship application is submitted, auto-generate a checklist of work items across departments based on the 19-step workflow.

### Phase 3: Compliance Enhancements
- Policy Registry table + page
- Filing Responsibility Tracker per NGO
- Compliance Calendar view with filing deadlines

### Phase 4: HR Automations
- Pre-load onboarding/offboarding checklists from Confluence content
- Wire volunteer applicant email SOP into Make.com automation triggers

### Phase 5: Portal & Reporting
- Enhanced portal with impact dashboards
- Annual report package submission form for NGOs

---

### Technical Details

**Forms (Phase 1)**: Each form is a row in `form_templates` with `schema_json` containing field definitions. No database migrations needed — the table and rendering infrastructure exist.

**NGO Pipeline (Phase 2)**: New page component using the existing `WorkItemsTable` + pipeline board pattern. A helper function auto-creates work items per department when onboarding is triggered.

**Compliance Registry (Phase 3)**: New `policy_registry` table (name, category, owner, review_date, status, document_path). New page at `/erp/compliance/policies`.

**Automations (Phase 4)**: Leverage existing `make_automations` table to define trigger events for applicant stage changes. Email templates stored as part of the automation config.

