# Phase 2: Deployment Checklist & Summary

## ✅ Completed Tasks

### 1. Database Migration Verification
- ✅ Created comprehensive verification SQL script: `supabase/migrations/20260124000001_verify_form_templates_migration.sql`
- ✅ Script verifies:
  - Total form count
  - Forms per module
  - Document upload field presence
  - Weekly report forms for all departments
  - No duplicate forms
  - Forms moved correctly (Partnership → Development, Curriculum → Program)
  - Deleted forms are gone
  - Renamed forms (Newsletter Content Submission)
  - New forms (IT Research Request)

### 2. Storage & RLS Setup
- ✅ Verified existing `ngo-documents` storage bucket exists
- ✅ Confirmed RLS policies cover form submission uploads
- ✅ Created migration to ensure bucket exists: `supabase/migrations/20260124000002_ensure_form_submissions_storage_access.sql`
- ✅ Form uploads use path: `form-submissions/{user_id}/{timestamp}_{filename}`
- ✅ Existing policies allow authenticated users to upload/view/update/delete

### 3. Test Data Seeding
- ✅ Created test data script: `supabase/migrations/20260124000003_test_data_seed.sql`
- ✅ Script creates:
  - Test NGO
  - Work items for My Queue testing (assigned to user)
  - Work items for Department Queue testing
  - Overdue work items for dashboard metrics
  - Work item with approval workflow

### 4. Dashboard Optimization
- ✅ Added limits to evidence pending list (top 50)
- ✅ Added limits to at-risk NGOs list (top 20)
- ✅ Increased UI display limits (10 items instead of 5)
- ✅ Added null checks for better error handling

### 5. Build Verification
- ✅ `npm run build` passes
- ✅ `tsc --noEmit` passes
- ✅ `npm run lint` passes (only warnings, no errors)

---

## 📋 Manual Steps Required

### Step 1: Apply Database Migrations

Run these migrations in order via Supabase SQL Editor:

1. **Main Migration** (if not already applied):
   ```sql
   -- Run: supabase/migrations/20260124000000_refactor_form_templates.sql
   ```

2. **Storage Verification**:
   ```sql
   -- Run: supabase/migrations/20260124000002_ensure_form_submissions_storage_access.sql
   ```

3. **Verification Queries**:
   ```sql
   -- Run: supabase/migrations/20260124000001_verify_form_templates_migration.sql
   -- Review results to ensure all checks pass
   ```

4. **Test Data** (optional, for testing):
   ```sql
   -- Run: supabase/migrations/20260124000003_test_data_seed.sql
   -- Note: Update user IDs in script with actual auth.users IDs
   ```

### Step 2: Verify Storage Bucket

1. Go to Supabase Dashboard → Storage
2. Verify `ngo-documents` bucket exists
3. Check RLS policies:
   - "Authenticated users can upload documents" (INSERT)
   - "Authenticated users can view documents" (SELECT)
   - "Authenticated users can update documents" (UPDATE)
   - "Authenticated users can delete documents" (DELETE)

### Step 3: Test Functionality

#### A. Form Templates
- [ ] Navigate to `/forms`
- [ ] Verify all modules appear with correct form counts
- [ ] Verify "Director to VP Weekly Report" exists for each department
- [ ] Verify "Newsletter Content Submission" exists (renamed from "Newsletter issue builder")
- [ ] Verify IT has "Research Request" form
- [ ] Verify deleted forms are gone (e.g., duplicate Expense requests, Asset request)

#### B. File Uploads in Forms
- [ ] Open any form (e.g., from Forms page)
- [ ] Verify "Attach Documents" field appears at bottom
- [ ] Upload a test file (PDF/image)
- [ ] Submit form
- [ ] Verify file uploads to storage bucket
- [ ] Verify file metadata appears in `form_submissions.payload_json`

#### C. My Queue
- [ ] Navigate to `/my-queue`
- [ ] Verify work items assigned to current user appear
- [ ] Verify filters work (status, priority)
- [ ] Click a work item to open drawer

#### D. Department Queue
- [ ] Navigate to `/dept-queue`
- [ ] Verify work items for user's departments appear
- [ ] Test bulk actions (update status, bump dates)
- [ ] Verify bulk operations work correctly

#### E. WorkItemDrawer
- [ ] Click any work item to open drawer
- [ ] Verify all fields display correctly:
  - Status, priority, assignee
  - Related NGO (with link)
  - Due date
  - Evidence status
- [ ] Test status update
- [ ] Test priority update
- [ ] Test assignee update
- [ ] Test adding comments
- [ ] Test approval workflow (if `approval_required` is true)

#### F. Dashboard Metrics
- [ ] Navigate to `/dashboard`
- [ ] Verify metrics card shows:
  - Active NGO count
  - Missing evidence count
  - Overdue items count
  - Items due in 7 days
- [ ] Verify "Open Work Items by Department" section
- [ ] Verify "Items Missing Evidence" list (if any)
- [ ] Verify "At-Risk NGOs" list (if any)

### Step 4: GitHub Pages Deployment

1. **Verify GitHub Secrets** are set:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `GITHUB_REPOSITORY` (auto-set by Actions)

2. **Push to main branch**:
   ```bash
   git add .
   git commit -m "Phase 2: Complete implementation with verification scripts"
   git push origin main
   ```

3. **Monitor GitHub Actions**:
   - Check `.github/workflows/deploy-pages.yml` runs successfully
   - Verify build completes
   - Verify deployment succeeds

4. **Test Deployed Site**:
   - Visit GitHub Pages URL
   - Test OAuth sign-in
   - Test deep link refresh (e.g., `/dashboard` → refresh)
   - Test form uploads
   - Test queues and drawer

---

## 🐛 Troubleshooting

### Migration Fails
- Check Supabase logs for specific error
- Verify `module_type` enum includes all modules
- Check for foreign key constraints
- Ensure unique index exists: `form_templates_module_name_unique`

### File Uploads Fail
- Verify storage bucket `ngo-documents` exists
- Check RLS policies allow authenticated users
- Verify file size < 50MB
- Check file type is in allowed MIME types
- Check browser console for errors

### Queues Show Empty
- Verify work items have `owner_user_id` (for My Queue)
- Verify work items have `department_id` (for Dept Queue)
- Check RLS policies allow user to see work items
- Verify user has correct role/permissions

### Dashboard Shows No Data
- Verify work items exist with correct statuses
- Check `useDashboardData` hook isn't erroring
- Verify NGOs exist with status "Active"
- Check browser console for errors

---

## 📊 Expected Results After Migration

### Form Templates
- **Total Active Forms**: ~50+ forms
- **Modules**: All 13 modules should have forms
- **Document Upload Field**: All forms should have `documents` field
- **Weekly Reports**: Each department should have "Director to VP Weekly Report"
- **No Duplicates**: No duplicate (module, name) pairs

### Work Items
- **My Queue**: Shows items where `owner_user_id = current_user.id`
- **Dept Queue**: Shows items where `department_id IN (user's departments)`
- **Bulk Actions**: Update status and bump dates work

### Dashboard
- **Metrics**: Accurate counts for NGOs, evidence, overdue items
- **Performance**: Loads quickly even with many work items
- **Lists**: Limited to top 10-20 items for performance

---

## 📝 Files Created/Modified

### New Files
- `supabase/migrations/20260124000001_verify_form_templates_migration.sql`
- `supabase/migrations/20260124000002_ensure_form_submissions_storage_access.sql`
- `supabase/migrations/20260124000003_test_data_seed.sql`
- `PHASE_2_DEPLOYMENT_CHECKLIST.md` (this file)

### Modified Files
- `src/hooks/useDashboardData.ts` - Added limits for performance
- `src/pages/Dashboard.tsx` - Increased display limits, added null checks
- `src/components/ngo/FormSubmissionSheet.tsx` - File upload implementation (already done)
- `src/hooks/useWorkItems.ts` - Queue queries implementation (already done)
- `src/components/work-items/WorkItemDrawer.tsx` - Full drawer implementation (already done)

---

## ✅ Phase 2 Complete

All implementation tasks are complete. The codebase is ready for:
1. Database migration application
2. Manual testing
3. GitHub Pages deployment

Next phase would be:
- **Phase 3**: User acceptance testing, bug fixes, performance tuning
- **Phase 4**: Production monitoring, analytics integration
