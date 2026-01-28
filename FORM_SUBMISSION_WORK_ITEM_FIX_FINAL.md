# Form Submission Work Item Creation - Final Fix

## Problem
Department forms (e.g., Development → Grant Opportunity) create `form_submissions` rows with `submission_status = 'submitted'`, but `work_item_id` stays NULL and no work items are created.

## Root Cause Analysis

The code path is:
1. `FormSubmissionSheet.handleSave()` → calls `createMutation.mutateAsync()`
2. `useCreateFormSubmission()` hook → should create work item
3. But logs aren't showing, suggesting the code isn't executing

## Changes Made

### 1. Added Comprehensive Logging

**File:** `src/components/ngo/FormSubmissionSheet.tsx`
- Log at start of `handleSave()`: `[FormSubmissionSheet] handleSave called`
- Log before calling mutation: `[FormSubmissionSheet] Calling createMutation.mutateAsync with:`
- Log after mutation completes: `[FormSubmissionSheet] createMutation completed`
- Log errors: `[FormSubmissionSheet] handleSave error caught`

**File:** `src/hooks/useFormSubmissions.ts`
- Log at start of mutation: `[useCreateFormSubmission] mutationFn called`
- Log before database insert: `[useCreateFormSubmission] Inserting form submission into database`
- Log after insert: `[useCreateFormSubmission] Form submission created`
- Log condition check: `[useCreateFormSubmission] Work item creation check`
- Log before helper call: `[useCreateFormSubmission] Calling createWorkItemForSubmission`
- Log after helper success: `[useCreateFormSubmission] Work item created successfully`
- Log before update: `[useCreateFormSubmission] Updating form submission with work_item_id`
- Log after update: `[useCreateFormSubmission] Form submission updated with work_item_id`
- Log if skipped: `[useCreateFormSubmission] Skipping work item creation` (with reason)
- Log errors: `[useCreateFormSubmission] onError handler called`

**File:** `src/lib/createWorkItemForSubmission.ts`
- Log department mapping: `[createWorkItemForSubmission] Department mapping`
- Log before insert: `[createWorkItemForSubmission] Inserting work item`
- Log after success: `[createWorkItemForSubmission] Work item created successfully`
- Log errors with full details: `[createWorkItemForSubmission] Error creating work item`

### 2. Fixed FormSubmissionSheet Input

**File:** `src/components/ngo/FormSubmissionSheet.tsx`
- Changed: Only include `work_item_id` in input if it was explicitly created via `workItemConfig`
- Before: Always passed `work_item_id: workItemId` (even if undefined)
- After: Only includes `work_item_id` if `workItemId` is truthy

### 3. Improved Condition Check

**File:** `src/hooks/useFormSubmissions.ts`
- More explicit check: `hasWorkItemId` checks for string type and non-empty
- Logs the condition check result with all relevant values

### 4. Error Handling

- All errors are thrown (not caught silently)
- Errors are logged with full details (message, stack, context)
- Form submission fails if work item creation fails
- User sees error toast if work item creation fails

## Testing Instructions

1. **Open Browser Console** (F12 → Console tab)
   - Make sure console is not filtered
   - Clear console before testing

2. **Submit a Form**:
   - Navigate to Forms page
   - Click Development → "Grant Opportunity"
   - Click "Launch Form"
   - Fill out form (select an NGO if possible)
   - Click "Submit" (not "Save Draft")

3. **Check Console Logs**:
   You should see this sequence:
   ```
   [FormSubmissionSheet] handleSave called { submit: true, ... }
   [FormSubmissionSheet] Creating new form submission { ... }
   [FormSubmissionSheet] Calling createMutation.mutateAsync with: { ... }
   [useCreateFormSubmission] mutationFn called { ... }
   [useCreateFormSubmission] Inserting form submission into database
   [useCreateFormSubmission] Form submission created { ... }
   [useCreateFormSubmission] Work item creation check { shouldCreateWorkItem: true }
   [useCreateFormSubmission] Creating work item for form submission { ... }
   [useCreateFormSubmission] Calling createWorkItemForSubmission { ... }
   [createWorkItemForSubmission] Department mapping { ... }
   [createWorkItemForSubmission] Inserting work item { ... }
   [createWorkItemForSubmission] Work item created successfully { ... }
   [useCreateFormSubmission] Work item created successfully { workItemId: "..." }
   [useCreateFormSubmission] Updating form submission with work_item_id { ... }
   [useCreateFormSubmission] Form submission updated with work_item_id { ... }
   [FormSubmissionSheet] createMutation completed { work_item_id: "..." }
   ```

4. **If logs show "Skipping work item creation"**:
   - Check the `reason` field in the log
   - Common reasons:
     - `'not submitted'` → Form was saved as draft, not submitted
     - `'work_item_id already exists'` → Work item was already created
     - `'no user'` → User is not authenticated

5. **If you see errors**:
   - Check the error message and stack trace
   - Common errors:
     - RLS policy violation → Check user permissions
     - Department not found → Check `org_units` table has matching department
     - Template not found → Check `form_templates` table

6. **Verify in Supabase**:
   ```sql
   SELECT 
     fs.id,
     ft.name AS template_name,
     fs.work_item_id,
     fs.submission_status,
     fs.submitted_at,
     fs.created_at
   FROM public.form_submissions fs
   JOIN public.form_templates ft ON fs.form_template_id = ft.id
   WHERE ft.module = 'development'
   ORDER BY fs.created_at DESC
   LIMIT 10;
   ```

7. **Verify Work Item Exists**:
   ```sql
   SELECT 
     wi.id,
     wi.title,
     wi.module,
     wi.department_id,
     wi.ngo_id,
     wi.owner_user_id,
     wi.created_at
   FROM public.work_items wi
   WHERE wi.type = 'form_submission'
   ORDER BY wi.created_at DESC
   LIMIT 10;
   ```

## Expected Results

After submitting a Development "Grant Opportunity" form:
- ✅ Console shows all log messages
- ✅ `form_submissions.work_item_id` is NOT NULL
- ✅ A row exists in `work_items` table
- ✅ Work item appears in My Queue
- ✅ Work item appears in Department Queue

## If Still Not Working

If logs still don't appear:
1. Check browser console filters (make sure "All levels" is selected)
2. Check if code is actually being executed (add `debugger;` statement)
3. Verify the build is using the latest code (check build timestamp)
4. Check for JavaScript errors preventing execution

If logs appear but work item isn't created:
1. Check the "Skipping work item creation" log for the reason
2. Check error logs for RLS or database errors
3. Verify RLS policies allow work item creation
4. Verify `org_units` table has matching departments
