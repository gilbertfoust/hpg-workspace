# Form Submission → Work Item Fix

## Problem
When submitting a form (e.g., Development "Grant Opportunity" form), the form submission was created successfully but no corresponding work item was created and `work_item_id` remained NULL.

## Root Cause
The previous implementation caught errors silently, allowing form submissions to succeed even when work item creation failed. Additionally, the work item creation logic was embedded directly in the mutation function, making it harder to debug and maintain.

## Solution

### 1. Created Dedicated Helper Function
**File:** `src/lib/createWorkItemForSubmission.ts` (NEW)

- Extracted work item creation logic into a reusable helper function
- Proper error handling: throws errors instead of silently catching them
- Uses proper TypeScript types from Supabase
- Clear interface: `CreateWorkItemForSubmissionParams` and `CreateWorkItemForSubmissionResult`

### 2. Updated Form Submission Hooks
**File:** `src/hooks/useFormSubmissions.ts`

#### `useCreateFormSubmission()`:
- Calls `createWorkItemForSubmission()` helper when form is submitted
- **Critical Change**: Errors are now thrown (not caught), causing form submission to fail if work item creation fails
- Updates form submission with `work_item_id` after work item is created
- Returns updated submission with `work_item_id` included

#### `useUpdateFormSubmission()`:
- Same logic for draft → submitted transitions
- Creates work item when updating from draft to submitted
- Proper error handling

### 3. Error Handling
- **Before**: Errors were caught and logged, form submission still succeeded
- **After**: Errors are thrown, causing form submission to fail with error toast
- User sees "Error saving form" toast if work item creation fails
- User sees "Form submitted" toast only when both form submission AND work item creation succeed

## Implementation Details

### Work Item Creation Flow

1. **Form Submission Created**:
   - User submits form → `useCreateFormSubmission()` called
   - Form submission inserted into database
   - If `submission_status === 'submitted'` and no `work_item_id` exists:

2. **Work Item Creation**:
   - Fetch form template (module, name)
   - Fetch NGO name if `ngo_id` exists
   - Call `createWorkItemForSubmission()` helper:
     - Build title: `"{template.name} – {ngo_name}"` or `"{template.name}"`
     - Extract description from first 3 payload fields
     - Map module to department_id
     - Create work item with all required fields
     - **Throws error if creation fails**

3. **Link Work Item**:
   - Update form_submission with `work_item_id`
   - **Throws error if update fails**
   - Return updated submission

### Which Templates Create Work Items?

**All templates** that are submitted (not saved as draft) will create work items. This includes:
- Development forms (e.g., "Grant Opportunity")
- Document requests
- All other form templates

**To exclude a template** from creating work items, you would need to:
1. Add a flag to `form_templates` table (e.g., `creates_work_item BOOLEAN DEFAULT true`)
2. Check this flag before creating work item
3. Or use `mapping_json` to configure behavior per template

## Testing

### Test Cases:
1. ✅ Submit form with NGO → Work item created with NGO name in title
2. ✅ Submit form without NGO → Work item created with template name only
3. ✅ Submit form → Work item appears in My Queue
4. ✅ Submit form → Work item appears in Department Queue
5. ✅ Submit form → `form_submissions.work_item_id` is set
6. ✅ Save draft → No work item created
7. ✅ Save draft then submit → Work item created on submit
8. ✅ Work item creation fails → Form submission fails with error toast
9. ✅ Work item linking fails → Form submission fails with error toast

## Files Changed

1. **NEW**: `src/lib/createWorkItemForSubmission.ts` - Helper function for work item creation
2. **MODIFIED**: `src/hooks/useFormSubmissions.ts` - Updated to use helper and proper error handling

## Migration Status

The RLS migration (`20260124000004_ensure_work_items_rls_for_form_submissions.sql`) should already be applied. If not, apply it to ensure users can create work items.

## How to Extend

### To exclude specific templates from creating work items:

1. Add a column to `form_templates`:
   ```sql
   ALTER TABLE public.form_templates 
   ADD COLUMN creates_work_item BOOLEAN DEFAULT true;
   ```

2. Update `useCreateFormSubmission()` to check this flag:
   ```typescript
   const { data: template } = await supabase
     .from('form_templates')
     .select('module, name, creates_work_item')
     .eq('id', input.form_template_id)
     .single();
   
   if (template?.creates_work_item !== false) {
     // Create work item
   }
   ```

### To customize work item fields per template:

Use `form_templates.mapping_json` to store custom configuration:
```json
{
  "work_item": {
    "priority": "high",
    "status": "in_progress",
    "evidence_required": true
  }
}
```

Then read this in `createWorkItemForSubmission()` and apply custom values.

## Next Steps

1. Test form submission with Development "Grant Opportunity" form
2. Verify work item appears in queues
3. Verify `form_submissions.work_item_id` is set
4. Test error case: Temporarily disable RLS → Verify form submission fails with error
