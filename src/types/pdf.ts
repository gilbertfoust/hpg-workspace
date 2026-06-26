export type PdfAnnotationType =
  | "highlight"
  | "text"
  | "note"
  | "stamp"
  | "signature_field";

export interface PdfAnnotation {
  id: string;
  type: PdfAnnotationType;
  pageIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  content?: string;
  color?: string;
  createdAt: string;
  author?: string;
}

export interface PdfSignaturePlacement {
  pageIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PdfSearchMatch {
  pageIndex: number;
  text: string;
  index: number;
}

export interface PdfPageInfo {
  index: number;
  width: number;
  height: number;
}

export interface FormPdfExportOptions {
  title: string;
  subtitle?: string;
  fields: Array<{ label: string; value: string }>;
  includeTimestamp?: boolean;
}

export const PDF_ANNOTATION_STORAGE_PREFIX = "hpg-pdf-annotations:";
