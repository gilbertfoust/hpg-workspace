# Form Submission → Work Item Implementation

## Summary

When a user submits any form (e.g., "Grant Opportunity" development form), the app now automatically creates a corresponding work item that appears in Work Items / queues.

## Changes Made

### 1. New Utility: Module to Department Mapping
**File:** `src/utils/moduleToDepartment.ts` (NEW)

- Maps `module_type` enum values to `org_units` department names
- Provides `getDepartmentIdForModule()` function to query Supabase for department_id
- Handles special cases:
  - `ngo_coordination` → `Program` department
  - `curriculum` → `Program` department with `Curriculum` sub-department
  - `partnerships` → `Partnership Development` department

### 2. Updated Form Submission Hook
**File:** `src/hooks/useFormSubmissions.ts`

#### `useCreateFormSubmission()` Changes:
- **Automatic Work Item Creation**: When `submission_status === 'submitted'` and no `work_item_id` exists, automatically creates a work item
- **Work Item Fields**:
  - `title`: `"{form_template.name} – {NGO name}"` or just `"{form_template.name}"` if no NGO
  - `description`: First 3 fields from payload_json (excluding documents)
  - `module`: From form template
  - `ngo_id`: From form submission
  - `department_id`: Mapped from module using `getDepartmentIdForModule()`
  - `owner_user_id`: Current authenticated user
  - `created_by_user_id`: Current authenticated user (required for RLS)
  - `status`: `'not_started'`
  - `priority`: `'medium'`
  - `evidence_required`: `false`
  - `type`: `'form_submission'`
- **Error Handling**: If work item creation fails, logs error and shows toast, but form submission still succeeds
- **Linking**: After work item creation, updates form_submission with `work_item_id`
- **Query Invalidation**: Invalidates work-items queries to refresh queues

#### `useUpdateFormSubmission()` Changes:
- **Draft → Submitted Transition**: When updating a draft to submitted status, creates work item if one doesn't exist
- Same work item creation logic as `useCreateFormSubmission()`
- Handles the case where a user saves a draft first, then submits later

### 3. RLS Policy Migration
**File:** `supabase/migrations/20260124000004_ensure_work_items_rls_for_form_submissions.sql` (NEW)

- Ensures existing policy "Users can create own work items" exists
- Adds additional policy "Internal users can create work items" for staff_member, department_lead, ngo_coordinator, admin_pm, super_admin roles
- Both policies require `created_by_user_id = auth.uid()` (which our implementation sets)

## Implementation Details

### Work Item Creation Flow

1. **Form Submission Created/Updated**:
   - User submits form via `FormSubmissionSheet`
   - `useCreateFormSubmission()` or `useUpdateFormSubmission()` is called
   - Form submission is saved to database

2. **Work Item Creation** (if `submission_status === 'submitted'`):
   - Fetch form template to get `module` and `name`
   - Fetch NGO name if `ngo_id` exists
   - Build work item title: `"{template.name} – {ngo_name}"` or `"{template.name}"`
   - Extract description from first 3 payload fields
   - Map module to department_id using `getDepartmentIdForModule()`
   - Create work item with all required fields
   - Update form_submission with `work_item_id`

3. **Error Handling**:
   - If work item creation fails, error is logged and toast shown
   - Form submission still succeeds (non-blocking)
   - User can manually create work item if needed

### Module → Department Mapping

| Module | Department Name | Sub-Department |
|--------|----------------|----------------|
| `development` | Development | - |
| `finance` | Finance | - |
| `ngo_coordination` | Program | - |
| `operations` | Operations | - |
| `marketing` | Marketing | - |
| `communications` | Communications | - |
| `hr` | HR | - |
| `it` | IT | - |
| `legal` | Legal | - |
| `program` | Program | - |
| `curriculum` | Program | Curriculum |
| `administration` | Administration | - |
| `partnerships` | Partnership Development | - |

## Testing Checklist

- [ ] Submit a form with NGO selected → Verify work item created with NGO name in title
- [ ] Submit a form without NGO → Verify work item created with template name only
- [ ] Submit a form → Verify work item appears in My Queue
- [ ] Submit a form → Verify work item appears in Department Queue (if user is department lead)
- [ ] Submit a form → Verify work item has correct department_id based on module
- [ ] Save draft, then submit → Verify work item created on submit
- [ ] Submit form with file uploads → Verify work item created (files excluded from description)
- [ ] Verify work item links back to form submission via `work_item_id`
- [ ] Test error case: Disable RLS temporarily → Verify form submission succeeds but work item creation fails gracefully

## Files Changed

1. **NEW**: `src/utils/moduleToDepartment.ts`
2. **MODIFIED**: `src/hooks/useFormSubmissions.ts`
3. **NEW**: `supabase/migrations/20260124000004_ensure_work_items_rls_for_form_submissions.sql`

## Notes

- Work items are only created when form is **submitted** (not when saved as draft)
- If `workItemConfig` is provided in `FormSubmissionSheet`, that takes precedence (existing behavior preserved)
- Work item creation is non-blocking - form submission succeeds even if work item creation fails
- All work items created from forms have `type = 'form_submission'` for easy filtering
