# Forms Page Diagnosis & Fix

## 1. UI Query Analysis

**File:** `src/pages/Forms.tsx` + `src/hooks/useFormTemplates.ts`

**Exact Query:**
```typescript
supabase
  .from('form_templates')
  .select('*')
  .eq('is_active', true)  // ← Only shows active templates
  .order('name', { ascending: true })
```

**Filters Applied:**
- ✅ `is_active = true` (both in query and UI filter on line 78)
- ✅ No module filter when called without parameter (shows all modules)
- ✅ UI groups by module dynamically

**Potential Issues:**
1. **Database has < 40 forms** - Most likely root cause
2. **Migration failed silently** - JSON syntax errors or constraint violations
3. **RLS policy blocking reads** - Less likely but possible
4. **Duplicates causing confusion** - Multiple rows with same (module, name)

---

## 2. SQL Audit Queries

**Run these in Supabase SQL Editor:**

```sql
-- 1a) Total count of form_templates
SELECT COUNT(*) as total_count FROM public.form_templates;

-- 1b) Count by module
SELECT module, COUNT(*) as count 
FROM public.form_templates 
WHERE is_active = true
GROUP BY module 
ORDER BY module;

-- 1c) Count by is_active status
SELECT is_active, COUNT(*) as count 
FROM public.form_templates 
GROUP BY is_active;

-- 1d) List of distinct module values
SELECT DISTINCT module 
FROM public.form_templates 
ORDER BY module;

-- 1e) Check for duplicates by (module, name)
SELECT module, name, COUNT(*) as duplicate_count
FROM public.form_templates
GROUP BY module, name
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC, module, name;

-- 2) RLS Policy Check - Test as authenticated user
SELECT 
  COUNT(*) as accessible_count,
  COUNT(DISTINCT module) as accessible_modules
FROM public.form_templates
WHERE is_active = true;

-- 3) Check for JSON syntax errors
SELECT 
  id,
  module,
  name,
  CASE 
    WHEN schema_json::text IS NULL THEN 'NULL schema_json'
    WHEN NOT (schema_json ? 'fields') THEN 'Missing fields key'
    WHEN jsonb_typeof(schema_json->'fields') != 'array' THEN 'fields is not an array'
    ELSE 'OK'
  END as json_status
FROM public.form_templates
WHERE is_active = true
ORDER BY module, name;

-- 4) Detailed view of all active templates
SELECT 
  id,
  module,
  name,
  description,
  is_active,
  created_at,
  jsonb_array_length(schema_json->'fields') as field_count
FROM public.form_templates
WHERE is_active = true
ORDER BY module, name;
```

**Key queries to run first:**

```sql
-- Total count
SELECT COUNT(*) as total_count FROM public.form_templates;

-- Count by module
SELECT module, COUNT(*) as count 
FROM public.form_templates 
WHERE is_active = true
GROUP BY module 
ORDER BY module;

-- Check duplicates
SELECT module, name, COUNT(*) as duplicate_count
FROM public.form_templates
GROUP BY module, name
HAVING COUNT(*) > 1;

-- RLS test (as authenticated user)
SELECT COUNT(*) as accessible_count
FROM public.form_templates
WHERE is_active = true;
```

**Expected Outcome (if issue exists):**
- Total count: ~10-15 (instead of 40+)
- Some modules missing entirely
- Duplicates present
- RLS should allow reads (policy: "Internal users can view templates")

---

## 3. Root Cause Diagnosis

**Most Likely:** The original migration (`20260123000000_seed_all_form_templates.sql`) failed due to:

1. **JSON Syntax Errors** - Raw JSON strings with quote escaping issues
2. **Missing Unique Constraint** - `ON CONFLICT DO NOTHING` won't work without unique index on (module, name)
3. **Mixed Patterns** - Some inserts use DO blocks, others use ON CONFLICT (inconsistent)
4. **Partial Failure** - Migration may have stopped mid-way, leaving only first ~10 forms

**Evidence:**
- Migration file has mixed INSERT patterns
- No unique constraint created before ON CONFLICT statements
- Raw JSON strings prone to syntax errors

---

## 4. Safe Migration Solution

**File:** `supabase/migrations/20260123000100_seed_all_form_templates_safe.sql`

**Key Features:**
- ✅ Uses `jsonb_build_object` / `jsonb_build_array` (no raw JSON strings)
- ✅ Creates unique index on (module, name) first
- ✅ Deduplicates existing records (keeps latest)
- ✅ Uses `ON CONFLICT (module, name) DO UPDATE` for idempotency
- ✅ Includes all 40+ forms from spec
- ✅ Includes HR "Staffing recruitment request" form
- ✅ Verification queries at end

**Total Forms:** 41 forms across 13 modules:
- NGO Coordination: 3
- Administration: 3
- Operations: 2
- Program: 2
- Curriculum: 2
- Development: 4
- Partnership Development: 3
- Marketing: 3
- Communications: 3
- HR: 5 (includes staffing recruitment request)
- IT: 2
- Finance: 4
- Legal/Compliance: 2

---

## 5. UI Code Patches

**File:** `src/pages/Forms.tsx`

**Changes Made:**
1. ✅ Added debug console logging (dev only) showing:
   - Total templates loaded
   - Active templates count
   - Breakdown by module
2. ✅ Graceful handling of unknown modules:
   - Falls back to formatted module name if not in mapping
   - Adds unknown modules to module list dynamically
3. ✅ Module display name fallback:
   - Converts snake_case to Title Case if mapping missing

**No breaking changes** - all changes are additive and defensive.

---

## 6. Checklist: Steps to Fix

### Step 1: Run Audit Queries
- [ ] Open Supabase SQL Editor
- [ ] Run queries from `AUDIT_QUERIES.sql`
- [ ] Note: total count, duplicates, missing modules

### Step 2: Apply Safe Migration
- [ ] Run `supabase/migrations/20260123000100_seed_all_form_templates_safe.sql`
- [ ] Check migration logs for errors
- [ ] Verify NOTICE messages show ~41 active templates

### Step 3: Verify Database
- [ ] Run verification query:
  ```sql
  SELECT module, COUNT(*) as count 
  FROM public.form_templates 
  WHERE is_active = true
  GROUP BY module 
  ORDER BY module;
  ```
- [ ] Should show all 13 modules with correct counts

### Step 4: Test UI
- [ ] Refresh Forms page (`/forms`)
- [ ] Open browser console (F12) → Check for debug logs
- [ ] Verify all module tabs appear
- [ ] Verify "All Forms" tab shows ~41 forms
- [ ] Click through each module tab, verify forms display

### Step 5: Confirm Fix
- [ ] "All Forms" tab shows 41 forms
- [ ] All 13 module tabs visible with correct counts
- [ ] No console errors
- [ ] Forms can be launched (non-NGO forms)

---

## 7. Expected Results After Fix

**Before:**
- UI shows: ~10 forms
- Modules visible: ~5-7 modules
- Console: No debug info

**After:**
- UI shows: 41 forms
- Modules visible: All 13 modules
- Console (dev): Debug logs showing breakdown
- Database: 41 active templates, no duplicates

---

## 8. Files Changed

1. ✅ `supabase/migrations/20260123000100_seed_all_form_templates_safe.sql` (NEW - safe migration)
2. ✅ `src/pages/Forms.tsx` (UPDATED - debug logging + graceful module handling)
3. ✅ `AUDIT_QUERIES.sql` (NEW - diagnostic queries)

**No changes to:**
- `src/hooks/useFormTemplates.ts` (query is correct)
- RLS policies (should already allow reads)
- Other components

---

## 9. Troubleshooting

**If migration fails:**
- Check Supabase logs for specific error
- Verify `module_type` enum includes all modules
- Check for foreign key constraints

**If UI still shows < 41:**
- Check browser console for errors
- Verify RLS policy allows SELECT
- Check network tab for failed query
- Verify `is_active = true` filter isn't too restrictive

**If duplicates appear:**
- Migration includes deduplication step
- If still present, run manually:
  ```sql
  DELETE FROM public.form_templates
  WHERE id IN (
    SELECT id FROM (
      SELECT id, ROW_NUMBER() OVER (PARTITION BY module, name ORDER BY updated_at DESC) as rn
      FROM public.form_templates
    ) t WHERE rn > 1
  );
  ```
