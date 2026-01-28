# Form Submission Work Item Creation - Fix Summary

## Problem
Department forms (e.g., Development → "Grant Opportunity") were failing with "Failed to save submission" error. Form submissions were created in the database with `submission_status = 'submitted'`, but `work_item_id` stayed NULL and no work items were created.

## Root Causes Identified

1. **RLS Policy Too Restrictive**: The original policy "Management can create work items" only allowed `is_management()` or `ngo_coordinator` roles to create work items. Regular authenticated users couldn't create work items, causing RLS violations.

2. **No DB Triggers**: Confirmed no database triggers exist that auto-create work items (only `update_updated_at` triggers exist).

3. **Error Messages Not Detailed**: Errors from Supabase weren't showing full details (code, details, hint), making debugging difficult.

## Changes Made

### 1. Database Migration: Fixed RLS Policies

**File:** `supabase/migrations/20260128030000_fix_work_items_rls_for_form_submissions.sql`

- **Dropped** the restrictive policy: `"Management can create work items"` 
- **Created** new policy: `"Authenticated users can create own work items"` - allows any authenticated user to create work items when `created_by_user_id = auth.uid()`
- **Created** backup policy: `"Internal users can create work items"` - for users with internal roles (staff_member, department_lead, etc.)
- **Added** verification query to show all INSERT policies

**Key Change**: Now any authenticated user can create work items, not just management/ngo_coordinator.

### 2. Improved Error Handling and Logging

**File:** `src/lib/createWorkItemForSubmission.ts`
- Enhanced error messages to include:
  - Supabase error code
  - Error details
  - Error hint
  - Full error object attached to thrown error
- Added detailed console logging with all error fields

**File:** `src/hooks/useFormSubmissions.ts`
- **useCreateFormSubmission**:
  - Enhanced error handling for:
    - Form submission insert failures
    - Form template fetch failures
    - Work item creation failures
    - Form submission update (linking work_item_id) failures
  - All errors now include Supabase error code, details, and hint
  - Errors are logged with step context (e.g., `step: 'insert_form_submission'`)
  
- **useUpdateFormSubmission**:
  - Enhanced error handling for:
    - Current submission fetch failures
    - Form submission update failures
    - Form template fetch failures
    - Work item creation failures
    - Work item linking failures
  - Added try-catch around work item creation with proper error propagation
  - All errors include full Supabase details

- **onError handlers**:
  - Extract Supabase error details from thrown errors
  - Display full error message including details and hint in toast
  - Log full error context to console

### 3. Code Flow Verification

**File:** `src/components/ngo/FormSubmissionSheet.tsx`
- Already correctly uses `useCreateFormSubmission()` and `useUpdateFormSubmission()` hooks
- Already properly omits `work_item_id` when undefined to let hooks create it
- No changes needed

## Submission Flow (Step-by-Step)

### New Form Submission (Submit, not Draft)

1. **User clicks "Submit"** in `FormSubmissionSheet`
   - `handleSave(submit: true)` is called
   - Log: `[FormSubmissionSheet] handleSave called`

2. **File uploads** are processed and merged into payload

3. **FormSubmissionSheet** calls `createMutation.mutateAsync()` with:
   - `form_template_id`
   - `ngo_id` (if provided)
   - `submitted_by_user_id`
   - `payload_json`
   - `submission_status: 'submitted'`
   - **NO** `work_item_id` (omitted so hook creates it)

4. **useCreateFormSubmission** hook:
   - Log: `[useCreateFormSubmission] mutationFn called`
   - **Step 1**: Insert form submission into `form_submissions` table
     - Log: `[useCreateFormSubmission] Inserting form submission into database`
     - On error: Log full Supabase error details, throw error with code/details/hint
   - Log: `[useCreateFormSubmission] Form submission created`
   - **Step 2**: Check if work item should be created
     - Log: `[useCreateFormSubmission] Work item creation check`
     - Condition: `submission_status === 'submitted' && !hasWorkItemId && !!user?.id`
   - **Step 3**: If condition met, create work item
     - Log: `[useCreateFormSubmission] Creating work item for form submission`
     - Fetch form template (module, name)
     - Fetch NGO name (if ngo_id provided)
     - Call `createWorkItemForSubmission()` helper
       - Log: `[createWorkItemForSubmission] Department mapping`
       - Log: `[createWorkItemForSubmission] Inserting work item`
       - Insert into `work_items` table with:
         - `created_by_user_id = auth.uid()` (required for RLS)
         - `owner_user_id = auth.uid()`
         - `department_id` (from module mapping)
         - `type = 'form_submission'`
       - On error: Log full Supabase error, throw with code/details/hint
       - Log: `[createWorkItemForSubmission] Work item created successfully`
     - Log: `[useCreateFormSubmission] Work item created successfully`
   - **Step 4**: Update form submission with work_item_id
     - Log: `[useCreateFormSubmission] Updating form submission with work_item_id`
     - Update `form_submissions.work_item_id = workItemId`
     - On error: Log full Supabase error, throw error
     - Log: `[useCreateFormSubmission] Form submission updated with work_item_id`
   - Return updated submission

5. **onSuccess** handler:
   - Invalidate queries (form-submissions, work-items, queues)
   - Show success toast: "Your form has been submitted and a work item has been created."

6. **onError** handler (if any step fails):
   - Log full error details to console
   - Extract Supabase error details (code, details, hint)
   - Show error toast with full message

### Draft Submission

- Same flow, but `submission_status = 'draft'`
- Work item creation is skipped (condition check fails)
- Log: `[useCreateFormSubmission] Skipping work item creation` with reason

### Update Draft → Submitted

1. **useUpdateFormSubmission** hook:
   - Fetch current submission
   - Update form submission
   - Check if transitioning from draft to submitted
   - If yes and no work_item_id exists, create work item (same flow as above)
   - Update form submission with work_item_id

## Error Handling

All Supabase errors now include:
- **Error code** (e.g., `PGRST116`, `42501`)
- **Error message** (human-readable)
- **Error details** (specific field/constraint that failed)
- **Error hint** (suggestions for fixing)

Example error message:
```
Failed to create work item: new row violates row-level security policy (code: 42501)
Details: Policy "Management can create work items" violated
Hint: Ensure created_by_user_id matches auth.uid()
```

## Testing Instructions

1. **Apply Migration**:
   ```sql
   -- Run in Supabase SQL Editor
   -- File: supabase/migrations/20260128030000_fix_work_items_rls_for_form_submissions.sql
   ```

2. **Submit a Form**:
   - Navigate to Forms → Development → "Grant Opportunity"
   - Click "Launch Form"
   - Fill out form (select NGO if possible)
   - Click "Submit"

3. **Check Console Logs**:
   - Should see all log messages in sequence
   - No errors should appear

4. **Verify in Supabase**:
   ```sql
   -- Check form submission has work_item_id
   SELECT 
     fs.id,
     ft.name AS template_name,
     fs.work_item_id,
     fs.submission_status,
     fs.created_at
   FROM public.form_submissions fs
   JOIN public.form_templates ft ON fs.form_template_id = ft.id
   WHERE ft.module = 'development'
   ORDER BY fs.created_at DESC
   LIMIT 10;

   -- Check work item exists
   SELECT 
     wi.id,
     wi.title,
     wi.module,
     wi.department_id,
     wi.ngo_id,
     wi.owner_user_id,
     wi.created_by_user_id,
     wi.type,
     wi.created_at
   FROM public.work_items wi
   WHERE wi.type = 'form_submission'
   ORDER BY wi.created_at DESC
   LIMIT 10;
   ```

5. **Verify Work Item Appears in Queues**:
   - My Queue should show the work item
   - Department Queue should show the work item (if user is department lead)

## Files Changed

1. **supabase/migrations/20260128030000_fix_work_items_rls_for_form_submissions.sql** (NEW)
   - Fixed RLS policies to allow authenticated users to create work items

2. **src/lib/createWorkItemForSubmission.ts**
   - Enhanced error messages with Supabase details

3. **src/hooks/useFormSubmissions.ts**
   - Enhanced error handling throughout
   - Added detailed logging at each step
   - Improved error messages in toasts

4. **src/components/ngo/FormSubmissionSheet.tsx**
   - No changes needed (already correct)

## Expected Results

After applying the migration and submitting a form:
- ✅ Form submission is created
- ✅ Work item is created automatically
- ✅ `form_submissions.work_item_id` is set correctly
- ✅ Work item appears in My Queue
- ✅ Work item appears in Department Queue (if applicable)
- ✅ Success toast shows: "Your form has been submitted and a work item has been created."
- ✅ If errors occur, full Supabase error details are shown in toast and console

## Next Steps

1. Apply the migration: `supabase/migrations/20260128030000_fix_work_items_rls_for_form_submissions.sql`
2. Test form submission
3. Check console logs for any remaining issues
4. Verify work items appear in queues
