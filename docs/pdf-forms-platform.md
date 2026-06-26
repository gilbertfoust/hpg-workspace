# PDF & Forms Platform

Technical reference for the HPG workspace PDF viewer, editor, form export, and e-signature stack.

## Overview

The platform provides Acrobat-style PDF capabilities in the browser using:

| Library | Role |
|---------|------|
| **pdfjs-dist** (Mozilla PDF.js) | Client-side PDF rendering, text search, thumbnails |
| **pdf-lib** | PDF creation, annotations export, merge/split, signature embedding |
| **react-signature-canvas** | Drawn signatures in forms and signing flows |

## Architecture

```
src/
├── components/pdf/
│   ├── PdfViewer.tsx          # Full-featured viewer (zoom, pan, search, print)
│   ├── PdfViewerDialog.tsx    # Modal wrapper for previews
│   ├── PdfEditor.tsx          # Annotation tools + export
│   └── PdfMergeSplitDialog.tsx
├── components/esign/
│   ├── ESignatureCapture.tsx  # Draw / type / upload signature
│   └── ESignaturePlacer.tsx   # Drag signature onto PDF page
├── lib/pdf/
│   ├── pdfWorker.ts           # PDF.js worker initialization
│   ├── pdfDocument.ts         # Load/download helpers
│   ├── pdfCreator.ts          # Blank & text PDF generation
│   ├── pdfMergeSplit.ts       # Merge, split, reorder, delete pages
│   ├── pdfAnnotations.ts      # Burn annotations & signatures into PDF
│   └── formToPdf.ts           # Form submission → PDF export
├── hooks/usePdfAnnotations.ts # Session-scoped annotation state
├── pages/PdfWorkspace.tsx     # Dedicated PDF create/edit workspace
└── pages/SignDocument.tsx     # Public e-sign flow
```

## PDF Viewer (`PdfViewer`)

**Features:** page navigation, thumbnail sidebar, zoom (slider + fit width/page), rotation, in-document text search, fullscreen, print current page, download original bytes.

**Usage:**

```tsx
<PdfViewer url={signedUrl} fileName="report.pdf" showThumbnails />
```

**Props:** `url`, `data` (Uint8Array), `fileName`, `overlay` (React node for signature placement), `onPageDimensions`, `onScaleChange`.

## PDF Editor (`PdfEditor`)

Wraps `PdfViewer` with annotation tools:

- **Highlight** — yellow overlay rectangles
- **Text / Note** — bordered text boxes
- **Stamp** — configurable stamp text (e.g. APPROVED)

Annotations persist in `sessionStorage` under `hpg-pdf-annotations:{documentId}`. **Export** burns annotations into a new PDF via `pdf-lib` and triggers download.

## PDF Workspace (`/pdf-workspace`)

Route for power users:

- Open local PDF files
- Create blank or text-based PDFs
- Edit with annotation tools
- Merge / split via dialog

## E-Signature Flow

1. Staff uploads PDF to **Documents → E-Sign Documents**
2. **Signing Requests** tab sends email with `/sign/:token` link
3. Signer views PDF in `PdfViewer`, captures signature via `ESignatureCapture`, positions with `ESignaturePlacer`
4. `process-signature` edge function embeds PNG + caption at `signature_placement` coordinates
5. Signed PDF stored in `esign-signed-documents` bucket; audit fields: `signed_at`, `signer_ip`

### Edge function payload

```json
{
  "token": "...",
  "signature_data": "data:image/png;base64,...",
  "signature_placement": { "pageIndex": 0, "x": 50, "y": 600, "width": 200, "height": 60 },
  "signer_caption": "Signed by Jane Doe on June 26, 2026"
}
```

## Forms Integration

### New field types

| Type | Behavior |
|------|----------|
| `signature` | `ESignatureCapture` → stored as data URL in `payload_json` |
| `file` | File name captured (metadata only) |

### PDF export

`FormSubmissionDetailSheet` → **Export PDF** calls `exportFormSubmissionToPdf()` which:

1. Renders all fields to a structured PDF
2. Appends signature image pages for `signature` fields

## Merge / Split Utilities

`pdfMergeSplit.ts`:

- `mergePdfs(sources[])` — concatenate documents
- `splitPdf(source, ranges)` — extract page ranges
- `extractPdfPages(source, indices)` — single or multiple pages
- `deletePdfPages` / `reorderPdfPages` — page management

Accessible from Documents page and PDF Workspace.

## Storage Buckets

| Bucket | Purpose |
|--------|---------|
| `ngo-documents` | General NGO / department documents |
| `esign-documents` | Unsigned PDFs for signing |
| `esign-signed-documents` | Completed signed PDFs |
| `ledger-receipts` | Finance receipt PDFs (viewer integrated) |

## Integration Points

| Location | Integration |
|----------|-------------|
| `/documents` | PDF preview dialog, merge/split, link to workspace |
| `/pdf-workspace` | Full create/edit experience |
| `/sign/:token` | Public signing with positioned signatures |
| Form submissions | Export PDF button |
| Finance receipts | `PdfViewerDialog` for PDF receipts |
| Financial reports | `financialPdfExport.ts` (browser print — unchanged) |

## Gaps vs Adobe Acrobat

Not implemented (future work):

- OCR / searchable image PDFs
- Native AcroForm field editing in uploaded PDFs
- Collaborative real-time co-editing
- PKCS#7 / certificate-based digital signatures
- Redaction with permanent content removal
- Advanced page cropping and image editing
- Server-side PDF/A compliance
- Multi-signer ordered workflows with field templates
- Annotation sync to Supabase (currently sessionStorage only)

## Dependencies

```json
"pdfjs-dist": "^4.10.38",
"pdf-lib": "^1.17.1",
"react-signature-canvas": "^1.1.0-alpha.2"
```

## Vite Configuration

`vite.config.ts` includes `optimizeDeps.include: ["pdfjs-dist"]` and ES worker format. PDF.js worker loaded via:

```ts
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorker;
```
