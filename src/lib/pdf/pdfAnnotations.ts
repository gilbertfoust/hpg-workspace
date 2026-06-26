import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";
import type { PdfAnnotation } from "@/types/pdf";
import { loadPdfBytes } from "./pdfDocument";

function parseColor(color?: string) {
  if (!color || !color.startsWith("#") || color.length < 7) {
    return rgb(1, 0.92, 0.4);
  }
  const r = parseInt(color.slice(1, 3), 16) / 255;
  const g = parseInt(color.slice(3, 5), 16) / 255;
  const b = parseInt(color.slice(5, 7), 16) / 255;
  return rgb(r, g, b);
}

export async function applyAnnotationsToPdf(
  source: string | ArrayBuffer | Uint8Array,
  annotations: PdfAnnotation[],
  rotationDegrees = 0
): Promise<Uint8Array> {
  const bytes = await loadPdfBytes(source);
  const doc = await PDFDocument.load(bytes);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pages = doc.getPages();

  if (rotationDegrees !== 0) {
    pages.forEach((page) => page.setRotation(degrees(rotationDegrees)));
  }

  for (const ann of annotations) {
    const page = pages[ann.pageIndex];
    if (!page) continue;
    const { height: pageHeight } = page.getSize();
    const pdfY = pageHeight - ann.y - ann.height;

    switch (ann.type) {
      case "highlight":
        page.drawRectangle({
          x: ann.x,
          y: pdfY,
          width: ann.width,
          height: ann.height,
          color: parseColor(ann.color),
          opacity: 0.35,
        });
        break;
      case "text":
      case "note":
        page.drawRectangle({
          x: ann.x,
          y: pdfY,
          width: ann.width,
          height: ann.height,
          borderColor: rgb(0.7, 0.7, 0.75),
          borderWidth: 0.5,
        });
        if (ann.content) {
          page.drawText(ann.content, {
            x: ann.x + 4,
            y: pdfY + ann.height - 12,
            size: 10,
            font,
            color: rgb(0.15, 0.15, 0.2),
            maxWidth: ann.width - 8,
          });
        }
        break;
      case "stamp":
        page.drawText(ann.content || "APPROVED", {
          x: ann.x,
          y: pdfY + ann.height / 2 - 6,
          size: 18,
          font,
          color: rgb(0.75, 0.1, 0.1),
          opacity: 0.7,
        });
        break;
      case "signature_field":
        page.drawRectangle({
          x: ann.x,
          y: pdfY,
          width: ann.width,
          height: ann.height,
          borderColor: rgb(0.2, 0.4, 0.8),
          borderWidth: 1,
          borderDashArray: [4, 2],
        });
        if (ann.content) {
          page.drawText(ann.content, {
            x: ann.x + 4,
            y: pdfY + 4,
            size: 8,
            font,
            color: rgb(0.3, 0.3, 0.35),
          });
        }
        break;
    }
  }

  return doc.save();
}

export async function embedSignatureOnPdf(
  source: string | ArrayBuffer | Uint8Array,
  signaturePngDataUrl: string,
  placement: { pageIndex: number; x: number; y: number; width: number; height: number },
  caption?: string
): Promise<Uint8Array> {
  const bytes = await loadPdfBytes(source);
  const doc = await PDFDocument.load(bytes);
  const pages = doc.getPages();
  const page = pages[placement.pageIndex] ?? pages[pages.length - 1];
  const { height: pageHeight } = page.getSize();

  const base64 = signaturePngDataUrl.split(",")[1];
  const sigBytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const sigImage = await doc.embedPng(sigBytes);
  const pdfY = pageHeight - placement.y - placement.height;

  page.drawImage(sigImage, {
    x: placement.x,
    y: pdfY,
    width: placement.width,
    height: placement.height,
  });

  if (caption) {
    const font = await doc.embedFont(StandardFonts.Helvetica);
    page.drawText(caption, {
      x: placement.x,
      y: pdfY - 14,
      size: 9,
      font,
      color: rgb(0.35, 0.35, 0.4),
    });
  }

  return doc.save();
}
