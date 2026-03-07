# Form Submission Work Item Creation - Debug Guide

## Issue
Department forms (e.g., Development → Grant Opportunity) save `form_submissions` rows with `submission_status = 'submitted'`, but `work_item_id` stays NULL and no work item appears in queues.

## Code Path Tracing

### 1. Form Submission Flow
**Component:** `src/pages/Forms.tsx`
- User clicks "Launch Form" on a form card
- Opens `FormSubmissionSheet` component
- `FormSubmissionSheet` calls `useCreateFormSubmission()` hook when form is submitted

**Component:** `src/components/ngo/FormSubmissionSheet.tsx`
- `handleSave(submit: boolean)` function handles form submission
- When `submit === true`, sets `status = "submitted"`
- Calls `createMutation.mutateAsync()` with:
  - `submission_status: status` (should be "submitted")
  - `work_item_id` is NOT included if `workItemId` is undefined (fixed)

**Hook:** `src/hooks/useFormSubmissions.ts`
- `useCreateFormSubmission()` mutation function:
  1. Creates form submission in database
  2. Checks: `input.submission_status === 'submitted' && !hasWorkItemId && !!user?.id`
  3. If condition passes, calls `createWorkItemForSubmission()`
  4. Updates form submission with `work_item_id`

**Helper:** `src/lib/createWorkItemForSubmission.ts`
- Creates work item with proper fields
- Maps module to department_id
- Throws error if creation fails

## Debugging Steps

### Check Browser Console
When submitting a form, check for these log messages:

1. **`[useCreateFormSubmission] Creating work item for form submission`**
   - Should appear if condition passes
   - If missing, check the logged "Skipping work item creation" reason

2. **`[useCreateFormSubmission] Calling createWorkItemForSubmission`**
   - Confirms helper function is being called

3. **`[createWorkItemForSubmission] Department mapping`**
   - Shows module → department_id mapping

4. **`[createWorkItemForSubmission] Inserting work item`**
   - Shows work item input before insert

5. **`[createWorkItemForSubmission] Work item created successfully`**
   - Confirms work item was created

6. **`[useCreateFormSubmission] Updating form submission with work_item_id`**
   - Confirms linking step

7. **`[useCreateFormSubmission] Form submission updated with work_item_id`**
   - Final confirmation

### Common Issues

1. **Condition not met:**
   - Check: `submission_status !== 'submitted'` → Verify form is actually submitted, not saved as draft
   - Check: `work_item_id` exists → Should be null/undefined for new submissions
   - Check: `user?.id` is null → User must be authenticated

2. **Work item creation fails:**
   - Check RLS policies: User must have permission to insert into `work_items`
   - Check: `created_by_user_id` must equal `auth.uid()` (we set this)
   - Check: `department_id` might be null if org_units table doesn't have matching department

3. **Linking fails:**
   - Check RLS policies: User must have permission to update `form_submissions`
   - Check: Form submission ID exists

## Verification Queries

Run these in Supabase SQL Editor to verify:

```sql
-- Check recent form submissions
SELECT 
  id,
  form_template_id,
  submission_status,
  work_item_id,
  ngo_id,
  submitted_by_user_id,
  created_at
FROM public.form_submissions
ORDER BY created_at DESC
LIMIT 10;

-- Check if work items exist for those submissions
SELECT 
  fs.id as submission_id,
  fs.submission_status,
  fs.work_item_id,
  wi.id as work_item_exists,
  wi.title,
  wi.module,
  wi.department_id
FROM public.form_submissions fs
LEFT JOIN public.work_items wi ON wi.id = fs.work_item_id
WHERE fs.submission_status = 'submitted'
ORDER BY fs.created_at DESC
LIMIT 10;

-- Check department mappings
SELECT 
  module,
  department_name,
  sub_department_name,
  id as department_id
FROM public.org_units
ORDER BY department_name, sub_department_name;
```

## Fixes Applied

1. **Fixed FormSubmissionSheet**: Don't pass `work_item_id: undefined` explicitly
2. **Improved condition check**: More explicit check for `work_item_id`
3. **Added comprehensive logging**: Console logs at every step
4. **Error handling**: Errors are thrown (not caught silently)
5. **Return updated submission**: Returns submission with `work_item_id` after update

## Testing

1. Open browser console (F12)
2. Navigate to Forms page
3. Click "Launch Form" on Development → "Grant Opportunity"
4. Fill out form and click "Submit"
5. Watch console for log messages
6. Check Supabase: Verify `form_submissions.work_item_id` is NOT NULL
7. Check My Queue: Verify work item appears
