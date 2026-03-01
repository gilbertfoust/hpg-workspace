

## Document Intake & Ledger Linking — Implementation Plan

### 1. Database Migration

**Three new tables + one storage bucket:**

```text
document_intake_submissions
├── id (uuid PK, default gen_random_uuid())
├── ngo_id (uuid, not null)
├── type (text, validated: receipt|donation|grant_award|vendor_invoice|reimbursement|other)
├── status (text, validated: submitted|extracted|processing|pending_review|approved|rejected)
├── file_path (text)
├── file_name (text)
├── submitted_by_user_id (uuid)
├── extracted_data_json (jsonb, default '{}')
├── reviewer_user_id (uuid, nullable)
├── reviewer_notes (text, nullable)
├── fiscal_period_id (uuid, nullable)
├── created_at (timestamptz, default now())
├── updated_at (timestamptz, default now())

document_to_transaction_links
├── id (uuid PK, default gen_random_uuid())
├── intake_id (uuid, not null)
├── transaction_id (uuid, not null)
├── created_at (timestamptz, default now())

document_extraction_logs
├── id (uuid PK, default gen_random_uuid())
├── intake_id (uuid, not null)
├── raw_text (text)
├── extracted_data_json (jsonb, default '{}')
├── confidence_score (numeric)
├── created_at (timestamptz, default now())
```

**Storage bucket:** `intake-documents` (private)

**Validation triggers:**
- `document_intake_submissions.type` — must be one of: receipt, donation, grant_award, vendor_invoice, reimbursement, other
- `document_intake_submissions.status` — must be one of: submitted, extracted, processing, pending_review, approved, rejected; also sets `updated_at = now()`

**RLS (all three tables):**
- SELECT: `is_internal_user() OR has_ngo_access(ngo_id)` (for links/logs: join through intake_id)
- INSERT: `is_internal_user() OR has_ngo_access(ngo_id)`
- UPDATE: `is_internal_user() OR has_ngo_access(ngo_id)`
- DELETE: `is_super_admin()`

### 2. OCR & Extraction Architecture

Use Lovable AI (Gemini 2.5 Flash) via an edge function `process-intake-document`:
1. Reads the uploaded file from `intake-documents` bucket
2. Sends file content to the AI model with a structured prompt requesting: date, amount, vendor/donor, description, category guess, transaction type
3. Returns structured JSON into `extracted_data_json`
4. Logs raw text + confidence to `document_extraction_logs`
5. Updates status to `pending_review`

The edge function is called client-side after upload completes.

### 3. New Hooks

| Hook | Purpose |
|------|---------|
| `useDocumentIntake(ngoId?)` | CRUD for intake submissions, list/filter by status/type |
| `useDocumentExtractionLogs(intakeId?)` | Read extraction history for a submission |
| `useDocumentToTransactionLinks(intakeId?)` | Read/create links between intake and transactions |
| `useIntakeApproval()` | Mutation: validates extracted data, creates transaction + journal entries via existing `useTransactions.create` pattern, inserts link, updates status to approved |

### 4. New Components

| Component | Description |
|-----------|-------------|
| `IntakeUploadDialog` | File upload to `intake-documents` bucket, select NGO + document type, triggers extraction edge function |
| `IntakeSubmissionsTable` | Filterable table of submissions with status badges, type icons, date, NGO filter |
| `IntakeReviewPanel` | Side-by-side: file preview (iframe/image) + editable extracted fields + account selectors for debit/credit + fiscal period selector + approve/reject buttons |
| `ExtractionPreviewCard` | Read-only card showing extracted fields with confidence indicators |
| `TransactionAutoBuilder` | Inline form for building debit/credit journal entry lines from extracted data, reuses `AccountSelector` |
| `LinkedTransactionBadge` | Small badge/link showing the linked transaction for approved items |

### 5. Pages & Routing

| Route | Page | Description |
|-------|------|-------------|
| `/financial-hub/intake` | `IntakeDashboard.tsx` | Overview: submission counts by status, NGO filter, table of all submissions, upload button |
| `/financial-hub/intake/review/:intakeId` | `IntakeReviewPage.tsx` | Full review panel for a single submission |

Both pages use `ProtectedRoute` + `MainLayout`.

### 6. Sidebar Update

Add under the Financial Hub sub-menu (between "Trial Balance" and "Compliance"):
```text
Financial Hub
  ├── Accounts
  ├── Transactions
  ├── General Ledger
  ├── Trial Balance
  ├── Intake              ← NEW
  └── Compliance
```

### 7. End-to-End Workflow

```text
Upload file → Store in intake-documents bucket
           → Insert document_intake_submissions (status: submitted)
           → Call process-intake-document edge function
           → AI extracts fields → saves to extracted_data_json
           → Status → pending_review

Reviewer opens IntakeReviewPage
           → Sees file preview + extracted fields (editable)
           → Selects debit/credit accounts, fiscal period
           → Clicks "Approve"
           → Creates transaction + journal_entries (Phase 2 engine)
           → Inserts document_to_transaction_links
           → Status → approved
           → Trial balance, GL, reconciliation all reflect the new transaction
```

### 8. Integration Points

- **Period locking:** IntakeReviewPanel checks `fiscal_periods.is_locked` before allowing approval for that period.
- **Reconciliation:** Intake-linked transactions appear in the existing reconciliation flow automatically (they are normal transactions).
- **Budget vs Actuals:** Unchanged — actuals still come from the `actuals` table; ledger transactions feed trial balance and GL independently.
- **E-Sign:** Optional — the review panel can include a "Request Signature" button that creates a signing request for the source document.

### 9. Implementation Order

1. Database migration (3 tables, triggers, RLS, storage bucket)
2. Edge function `process-intake-document` (AI-powered extraction)
3. Hooks (`useDocumentIntake`, `useDocumentExtractionLogs`, `useDocumentToTransactionLinks`, `useIntakeApproval`)
4. Components (`IntakeUploadDialog`, `IntakeSubmissionsTable`, `ExtractionPreviewCard`, `TransactionAutoBuilder`, `IntakeReviewPanel`)
5. Pages (`IntakeDashboard`, `IntakeReviewPage`)
6. Sidebar + routing updates

