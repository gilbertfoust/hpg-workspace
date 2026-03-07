# Form Submissions Payload Audit - Fix Summary

## Problem
Ensuring all `form_submissions` insert/update operations only use valid database column names (snake_case) and that all form field values are nested in `payload_json`, not as top-level keys.

## Valid Database Columns
Only these top-level keys are allowed:
- `form_template_id`
- `work_item_id`
- `ngo_id`
- `submitted_by_user_id`
- `payload_json`
- `submitted_at`
- `submission_status`
- `created_at` (only if needed)
- `updated_at` (only if needed)

All form field values (e.g., "legal_name", "amount", "deadline", etc.) MUST be nested inside `payload_json`.

## Changes Made

### 1. `useCreateFormSubmission` - INSERT Operation

**File:** `src/hooks/useFormSubmissions.ts` (Line ~127)

**Before:**
```typescript
const { data: submission, error: submissionError } = await supabase
  .from('form_submissions')
  .insert(input)
  .select()
  .single();
```

**After:**
```typescript
// Sanitize input to only include valid database columns
const sanitizedInput: Record<string, unknown> = {};
if (input.form_template_id) sanitizedInput.form_template_id = input.form_template_id;
if (input.ngo_id !== undefined) sanitizedInput.ngo_id = input.ngo_id || null;
if (input.work_item_id !== undefined) sanitizedInput.work_item_id = input.work_item_id || null;
if (input.submitted_by_user_id !== undefined) sanitizedInput.submitted_by_user_id = input.submitted_by_user_id || null;
if (input.payload_json !== undefined) sanitizedInput.payload_json = input.payload_json;
if (input.submission_status !== undefined) sanitizedInput.submission_status = input.submission_status;

const { data: submission, error: submissionError } = await supabase
  .from('form_submissions')
  .insert(sanitizedInput)
  .select()
  .single();
```

**Changes:**
- Added explicit sanitization to only include valid keys
- Added logging to show which keys are being inserted
- Ensures no extra keys or camelCase names are sent

### 2. `useCreateFormSubmission` - UPDATE Operation (work_item_id)

**File:** `src/hooks/useFormSubmissions.ts` (Line ~256)

**Status:** ✅ Already correct
```typescript
.update({ work_item_id: workItemId })
```
- Only updates `work_item_id`, which is valid

### 3. `useUpdateFormSubmission` - UPDATE Operation

**File:** `src/hooks/useFormSubmissions.ts` (Line ~401)

**Before:**
```typescript
const { data: submission, error: updateError } = await supabase
  .from('form_submissions')
  .update(input)
  .eq('id', id)
  .select()
  .single();
```

**After:**
```typescript
// Sanitize input to only include valid database columns
const sanitizedUpdate: Record<string, unknown> = {};
const validKeys = [
  'form_template_id',
  'work_item_id',
  'ngo_id',
  'submitted_by_user_id',
  'payload_json',
  'submitted_at',
  'submission_status',
  'created_at',
  'updated_at',
];

for (const key of validKeys) {
  if (key in input && input[key as keyof typeof input] !== undefined) {
    sanitizedUpdate[key] = input[key as keyof typeof input];
  }
}

const { data: submission, error: updateError } = await supabase
  .from('form_submissions')
  .update(sanitizedUpdate)
  .eq('id', id)
  .select()
  .single();
```

**Changes:**
- Added explicit sanitization using a whitelist of valid keys
- Only includes keys that exist in `input` and are in the whitelist
- Added logging to show which keys are being updated
- Prevents any extra keys or camelCase names from being sent

### 4. `useUpdateFormSubmission` - UPDATE Operation (work_item_id)

**File:** `src/hooks/useFormSubmissions.ts` (Line ~512)

**Status:** ✅ Already correct
```typescript
.update({ work_item_id: workItemId })
```
- Only updates `work_item_id`, which is valid

### 5. `FormSubmissionSheet` - Payload Construction

**File:** `src/components/ngo/FormSubmissionSheet.tsx` (Line ~133-186)

**Status:** ✅ Already correct

**Create Input:**
```typescript
const createInput: Parameters<typeof createMutation.mutateAsync>[0] = {
  form_template_id: template.id,        // ✅ snake_case
  ngo_id: ngoId,                         // ✅ snake_case
  submitted_by_user_id: user?.id,        // ✅ snake_case
  payload_json: payload,                 // ✅ snake_case, contains all form fields
  submission_status: status,             // ✅ snake_case
};
```

**Update Payload:**
```typescript
const updatePayload: Partial<FormSubmission> = {
  payload_json: payload,                 // ✅ snake_case, contains all form fields
  submission_status: status,              // ✅ snake_case
  submitted_at: submit ? new Date().toISOString() : submission.submitted_at,  // ✅ snake_case
  work_item_id: workItemId,              // ✅ snake_case (optional)
};
```

**Form Field Values:**
- All form field values are correctly nested in `payload_json` (Line ~133-136)
- No form fields are sent as top-level keys ✅

## Verification

### All Insert/Update Operations Audited:

1. ✅ **useCreateFormSubmission INSERT** (Line ~127)
   - Now sanitized to only include valid keys
   - Logs sanitized keys

2. ✅ **useCreateFormSubmission UPDATE** (Line ~256)
   - Only updates `work_item_id` ✅

3. ✅ **useUpdateFormSubmission UPDATE** (Line ~401)
   - Now sanitized using whitelist of valid keys
   - Logs sanitized keys

4. ✅ **useUpdateFormSubmission UPDATE** (Line ~512)
   - Only updates `work_item_id` ✅

5. ✅ **FormSubmissionSheet payload construction**
   - Uses snake_case column names ✅
   - All form fields nested in `payload_json` ✅

## Testing

After these changes:
1. ✅ `npm run build` passes
2. Submit a Development → "Grant Opportunity" form
3. Check browser Network tab:
   - Request to `/rest/v1/form_submissions` should return 201 (insert) or 200 (update)
   - Request body should only contain valid snake_case keys
   - All form field values should be in `payload_json`
4. Check Supabase:
   - New row should have `submission_status = 'submitted'`
   - `payload_json` should contain all form answers
   - `work_item_id` should be set after work item creation

## Summary

All insert/update operations now:
- ✅ Use only valid database column names (snake_case)
- ✅ Sanitize input to prevent extra keys
- ✅ Nest all form field values in `payload_json`
- ✅ Log which keys are being sent for debugging
- ✅ Handle null/undefined values correctly

No camelCase column names or extra top-level keys will be sent to Supabase.
