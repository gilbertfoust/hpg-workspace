import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { FormPdfExportOptions } from "@/types/pdf";

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 50;
const LINE_HEIGHT = 16;

function wrapText(text: string, maxWidth: number, fontSize: number): string[] {
  const approxCharWidth = fontSize * 0.5;
  const maxChars = Math.floor(maxWidth / approxCharWidth);
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

export async function createFormSubmissionPdf(options: FormPdfExportOptions): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  page.drawText(options.title, { x: MARGIN, y, size: 18, font: bold, color: rgb(0.1, 0.1, 0.2) });
  y -= 28;

  if (options.subtitle) {
    page.drawText(options.subtitle, { x: MARGIN, y, size: 11, font, color: rgb(0.4, 0.4, 0.45) });
    y -= 22;
  }

  if (options.includeTimestamp !== false) {
    page.drawText(`Generated: ${new Date().toLocaleString()}`, {
      x: MARGIN,
      y,
      size: 9,
      font,
      color: rgb(0.5, 0.5, 0.55),
    });
    y -= 28;
  }

  const contentWidth = PAGE_WIDTH - MARGIN * 2;

  for (const field of options.fields) {
    if (y < MARGIN + 60) {
      page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
    }

    page.drawText(field.label, { x: MARGIN, y, size: 10, font: bold, color: rgb(0.35, 0.35, 0.4) });
    y -= LINE_HEIGHT;

    const valueLines = wrapText(field.value || "—", contentWidth, 11);
    for (const line of valueLines) {
      if (y < MARGIN + 20) {
        page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        y = PAGE_HEIGHT - MARGIN;
      }
      page.drawText(line, { x: MARGIN, y, size: 11, font, color: rgb(0.1, 0.1, 0.15) });
      y -= LINE_HEIGHT;
    }
    y -= 10;
  }

  return doc.save();
}

export async function createBlankPdf(pageCount = 1): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pageCount; i++) {
    doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  }
  return doc.save();
}

export async function createTextPdf(title: string, body: string): Promise<Uint8Array> {
  return createFormSubmissionPdf({
    title,
    fields: [{ label: "Content", value: body }],
  });
}
