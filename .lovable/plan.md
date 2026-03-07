

# Backend Connectivity Audit — Files Requiring Database Tables or Configuration

This audit identifies every file in the project that references backend functionality (tables, edge functions, storage, secrets) that is **not yet created or connected** in your Supabase project. You can use this list in Cursor to create the missing migrations and configure secrets.

---

## 1. Missing Database Tables (10 tables)

These tables are referenced in hooks via `as never` casts because they do **not exist** in the database (confirmed absent from `types.ts`). Each needs a migration with CREATE TABLE, RLS policies, and validation triggers.

| Missing Table | Referenced In (files to review) |
|---|---|
| `reminders` | `src/hooks/useReminders.ts`, `src/lib/reminders.ts` |
| `work_items` | `src/hooks/useWorkItems.ts`, `src/lib/createWorkItemForSubmission.ts` |
| `tickets` | `src/hooks/useITTickets.ts` |
| `access_requests` | `src/hooks/useITAccessRequests.ts` |
| `applicants` | `src/hooks/useHRApplicants.ts` |
| `job_requisitions` | `src/hooks/useHRRequisitions.ts` |
| `interviews` | `src/hooks/useHRInterviews.ts` |
| `funders` | `src/hooks/useDevelopmentFunders.ts` |
| `proposals` | `src/hooks/useDevelopmentProposals.ts` |
| `partners` | `src/hooks/usePartnershipsPartners.ts` |
| `partnership_pipeline` | `src/hooks/usePartnershipsPipeline.ts` |

**What to do:** Write SQL migrations for each table matching the column shapes defined in the corresponding hook files. Add RLS policies using the existing `is_internal_user()` / `is_management()` / `is_super_admin()` pattern. After migrating, regenerate `src/integrations/supabase/types.ts` and remove all `as never` casts.

---

## 2. Missing Database Tables for Other Modules

These tables are referenced in the types/hooks but may also be missing (verify in your Supabase dashboard):

| Table | Referenced In |
|---|---|
| `supply_request_items` | `src/hooks/useSupplyRequests.ts` (join table for supply requests) |
| `signed_documents` | `src/pages/SignDocument.tsx` (stores signed PDF records) |

---

## 3. Edge Functions — Missing Secrets

All 4 edge functions exist in code but depend on secrets that are **not configured**:

| Edge Function | File | Missing Secrets |
|---|---|---|
| `send-signing-email` | `supabase/functions/send-signing-email/index.ts` | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `APP_URL` |
| `send-signed-notification` | `supabase/functions/send-signed-notification/index.ts` | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `ADMIN_EMAIL` |
| `process-signature` | `supabase/functions/process-signature/index.ts` | `SUPABASE_SERVICE_ROLE_KEY` (exists), but also writes to `esign-signed-documents` bucket and `signed_documents` table |
| `process-intake-document` | `supabase/functions/process-intake-document/index.ts` | `LOVABLE_API_KEY` (exists) — functional if AI gateway is reachable |

**What to do:** Set the SMTP secrets in your Supabase project dashboard under Edge Function Secrets. Set `APP_URL` to your published domain (`https://hpg-workspace.lovable.app`).

---

## 4. Storage Buckets — Verify RLS Policies

These 6 buckets exist but may lack proper RLS policies on `storage.objects`:

| Bucket | Used In |
|---|---|
| `ngo-documents` | `src/hooks/useDocuments.ts` |
| `esign-documents` | `src/hooks/useEsignDocuments.ts` |
| `esign-signed-documents` | `supabase/functions/process-signature/index.ts` |
| `ledger-receipts` | `src/components/finance/ReceiptUploader.tsx` |
| `compliance-packages` | compliance package workflows |
| `intake-documents` | `src/components/intake/IntakeUploadDialog.tsx` |

**What to do:** For each bucket, ensure `storage.objects` has INSERT/SELECT/DELETE policies matching the app's auth model (e.g., authenticated users can upload, internal users can read).

---

## 5. Database Function Missing Table Dependencies

| Function | File | Depends On |
|---|---|---|
| `get_signing_request_by_token` | Used in `SignDocument.tsx` and `process-signature/index.ts` | `signing_requests` + `esign_documents` tables (these exist) |

---

## 6. `supabase/config.toml` Mismatch

The config file references project `mlmjlgmsrkemsuwdohsa` but the `.env` points to `kukouthgyeacbpghubas`. If deploying via GitHub to the external Supabase project, ensure `config.toml` has the correct project ID.

**File:** `supabase/config.toml` — update `project_id` to match your target.

---

## 7. Auth Context

**File:** `src/contexts/AuthContext.tsx`

The `deleteAccount` and `deleteUser` functions call `supabase.auth.admin.deleteUser()` which requires the **service role key** — this will fail from the client. These need an edge function or should be removed.

---

## Summary Checklist for Cursor

1. **Create 11 missing tables** with migrations (see Section 1-2)
2. **Regenerate types** — run `supabase gen types typescript` after migrations
3. **Remove all `as never` casts** across ~16 hook files
4. **Configure SMTP secrets** for e-signature email flows
5. **Add storage RLS policies** for all 6 buckets
6. **Fix `config.toml` project_id** if deploying to external Supabase
7. **Move `deleteUser` to an edge function** using service role key

