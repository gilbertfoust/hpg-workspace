import { useCallback, useEffect, useState } from "react";
import type { PdfAnnotation } from "@/types/pdf";
import { PDF_ANNOTATION_STORAGE_PREFIX } from "@/types/pdf";

function storageKey(documentId: string) {
  return `${PDF_ANNOTATION_STORAGE_PREFIX}${documentId}`;
}

export function usePdfAnnotations(documentId: string) {
  const [annotations, setAnnotations] = useState<PdfAnnotation[]>([]);

  useEffect(() => {
    if (!documentId) return;
    try {
      const raw = sessionStorage.getItem(storageKey(documentId));
      if (raw) setAnnotations(JSON.parse(raw) as PdfAnnotation[]);
      else setAnnotations([]);
    } catch {
      setAnnotations([]);
    }
  }, [documentId]);

  const persist = useCallback(
    (next: PdfAnnotation[]) => {
      setAnnotations(next);
      if (documentId) {
        sessionStorage.setItem(storageKey(documentId), JSON.stringify(next));
      }
    },
    [documentId]
  );

  const addAnnotation = useCallback(
    (annotation: Omit<PdfAnnotation, "id" | "createdAt">) => {
      const entry: PdfAnnotation = {
        ...annotation,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
      };
      persist([...annotations, entry]);
      return entry;
    },
    [annotations, persist]
  );

  const updateAnnotation = useCallback(
    (id: string, patch: Partial<PdfAnnotation>) => {
      persist(annotations.map((a) => (a.id === id ? { ...a, ...patch } : a)));
    },
    [annotations, persist]
  );

  const removeAnnotation = useCallback(
    (id: string) => {
      persist(annotations.filter((a) => a.id !== id));
    },
    [annotations, persist]
  );

  const clearAnnotations = useCallback(() => persist([]), [persist]);

  return {
    annotations,
    addAnnotation,
    updateAnnotation,
    removeAnnotation,
    clearAnnotations,
  };
}
