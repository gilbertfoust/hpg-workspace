import type { FormField } from "@/hooks/useFormTemplates";
import { createFormSubmissionPdf } from "./pdfCreator";

function formatFieldValue(value: unknown, field: FormField): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.join(", ");
  if (field.type === "signature" && typeof value === "string" && value.startsWith("data:image")) {
    return "[Signature captured]";
  }
  return String(value);
}

export async function exportFormSubmissionToPdf(
  templateName: string,
  fields: FormField[],
  payload: Record<string, unknown>,
  meta?: { ngoName?: string; submittedBy?: string; submittedAt?: string }
): Promise<Uint8Array> {
  const subtitle = [
    meta?.ngoName ? `NGO: ${meta.ngoName}` : null,
    meta?.submittedBy ? `Submitted by: ${meta.submittedBy}` : null,
    meta?.submittedAt ? `Date: ${meta.submittedAt}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const exportFields = fields.map((field) => ({
    label: field.label,
    value: formatFieldValue(payload[field.name], field),
  }));

  const bytes = await createFormSubmissionPdf({
    title: templateName,
    subtitle: subtitle || undefined,
    fields: exportFields,
  });

  const hasSignature = fields.some(
    (f) => f.type === "signature" && typeof payload[f.name] === "string" && String(payload[f.name]).startsWith("data:image")
  );

  if (!hasSignature) return bytes;

  const { PDFDocument } = await import("pdf-lib");
  const doc = await PDFDocument.load(bytes);
  const font = await doc.embedFont((await import("pdf-lib")).StandardFonts.Helvetica);

  for (const field of fields) {
    if (field.type !== "signature") continue;
    const dataUrl = payload[field.name];
    if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image")) continue;

    const page = doc.addPage([612, 792]);
    page.drawText(`Signature: ${field.label}`, { x: 50, y: 740, size: 12, font });

    const base64 = dataUrl.split(",")[1];
    const sigBytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const sigImage = await doc.embedPng(sigBytes);
    const width = 220;
    const height = (sigImage.height / sigImage.width) * width;
    page.drawImage(sigImage, { x: 50, y: 600, width, height });
  }

  return doc.save();
}
