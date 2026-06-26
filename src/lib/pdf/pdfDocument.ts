import { PDFDocument } from "pdf-lib";
import { initPdfWorker, pdfjs } from "./pdfWorker";

export async function loadPdfBytes(source: string | ArrayBuffer | Uint8Array): Promise<Uint8Array> {
  if (typeof source === "string") {
    const response = await fetch(source);
    if (!response.ok) throw new Error("Failed to load PDF");
    return new Uint8Array(await response.arrayBuffer());
  }
  if (source instanceof ArrayBuffer) return new Uint8Array(source);
  return source;
}

export async function getPdfPageCount(source: string | ArrayBuffer | Uint8Array): Promise<number> {
  initPdfWorker();
  const bytes = await loadPdfBytes(source);
  const doc = await pdfjs.getDocument({ data: bytes }).promise;
  return doc.numPages;
}

export async function loadPdfLibDocument(source: string | ArrayBuffer | Uint8Array) {
  const bytes = await loadPdfBytes(source);
  return PDFDocument.load(bytes);
}

export async function downloadPdfBytes(bytes: Uint8Array, fileName: string) {
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
