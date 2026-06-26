import { PDFDocument } from "pdf-lib";
import { loadPdfBytes } from "./pdfDocument";

export async function mergePdfs(sources: Array<string | ArrayBuffer | Uint8Array>): Promise<Uint8Array> {
  const merged = await PDFDocument.create();

  for (const source of sources) {
    const bytes = await loadPdfBytes(source);
    const doc = await PDFDocument.load(bytes);
    const pages = await merged.copyPages(doc, doc.getPageIndices());
    pages.forEach((page) => merged.addPage(page));
  }

  return merged.save();
}

export async function splitPdf(
  source: string | ArrayBuffer | Uint8Array,
  ranges: Array<{ start: number; end: number }>
): Promise<Uint8Array[]> {
  const bytes = await loadPdfBytes(source);
  const doc = await PDFDocument.load(bytes);
  const pageCount = doc.getPageCount();
  const results: Uint8Array[] = [];

  for (const range of ranges) {
    const newDoc = await PDFDocument.create();
    const start = Math.max(0, range.start);
    const end = Math.min(pageCount - 1, range.end);
    const indices = Array.from({ length: end - start + 1 }, (_, i) => start + i);
    const pages = await newDoc.copyPages(doc, indices);
    pages.forEach((page) => newDoc.addPage(page));
    results.push(await newDoc.save());
  }

  return results;
}

export async function extractPdfPages(
  source: string | ArrayBuffer | Uint8Array,
  pageIndices: number[]
): Promise<Uint8Array> {
  const bytes = await loadPdfBytes(source);
  const doc = await PDFDocument.load(bytes);
  const newDoc = await PDFDocument.create();
  const validIndices = pageIndices.filter((i) => i >= 0 && i < doc.getPageCount());
  const pages = await newDoc.copyPages(doc, validIndices);
  pages.forEach((page) => newDoc.addPage(page));
  return newDoc.save();
}

export async function deletePdfPages(
  source: string | ArrayBuffer | Uint8Array,
  pagesToDelete: number[]
): Promise<Uint8Array> {
  const bytes = await loadPdfBytes(source);
  const doc = await PDFDocument.load(bytes);
  const deleteSet = new Set(pagesToDelete);
  const keepIndices = doc.getPageIndices().filter((i) => !deleteSet.has(i));
  const newDoc = await PDFDocument.create();
  const pages = await newDoc.copyPages(doc, keepIndices);
  pages.forEach((page) => newDoc.addPage(page));
  return newDoc.save();
}

export async function reorderPdfPages(
  source: string | ArrayBuffer | Uint8Array,
  newOrder: number[]
): Promise<Uint8Array> {
  return extractPdfPages(source, newOrder);
}
