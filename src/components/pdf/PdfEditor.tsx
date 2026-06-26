import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { PdfViewer } from "./PdfViewer";
import { usePdfAnnotations } from "@/hooks/usePdfAnnotations";
import type { PdfAnnotationType } from "@/types/pdf";
import { applyAnnotationsToPdf } from "@/lib/pdf/pdfAnnotations";
import { downloadPdfBytes, loadPdfBytes } from "@/lib/pdf/pdfDocument";
import {
  Highlighter,
  MessageSquare,
  Stamp,
  Type,
  Save,
  Trash2,
  PenLine,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type EditorTool = PdfAnnotationType | "select";

interface PdfEditorProps {
  url?: string;
  data?: ArrayBuffer | Uint8Array;
  fileName?: string;
  documentId: string;
  className?: string;
}

export function PdfEditor({ url, data, fileName = "edited.pdf", documentId, className }: PdfEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [tool, setTool] = useState<EditorTool>("select");
  const [stampText, setStampText] = useState("APPROVED");
  const [pageDims, setPageDims] = useState({ width: 612, height: 792, pageIndex: 0 });
  const [scale, setScale] = useState(1);
  const [draftRect, setDraftRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);

  const { annotations, addAnnotation, removeAnnotation, clearAnnotations } = usePdfAnnotations(documentId);

  const pageAnnotations = annotations.filter((a) => a.pageIndex === pageDims.pageIndex);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (tool === "select" || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;
    dragStart.current = { x, y };
    setDraftRect({ x, y, w: 0, h: 0 });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragStart.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;
    const sx = dragStart.current.x;
    const sy = dragStart.current.y;
    setDraftRect({
      x: Math.min(sx, x),
      y: Math.min(sy, y),
      w: Math.abs(x - sx),
      h: Math.abs(y - sy),
    });
  };

  const handlePointerUp = () => {
    if (!draftRect || tool === "select") {
      setDraftRect(null);
      dragStart.current = null;
      return;
    }
    if (draftRect.w > 8 && draftRect.h > 8) {
      addAnnotation({
        type: tool,
        pageIndex: pageDims.pageIndex,
        x: draftRect.x,
        y: draftRect.y,
        width: draftRect.w,
        height: draftRect.h,
        content: tool === "stamp" ? stampText : tool === "note" ? "Note" : undefined,
        color: tool === "highlight" ? "#FFE566" : undefined,
      });
    }
    setDraftRect(null);
    dragStart.current = null;
    setTool("select");
  };

  const handleExport = useCallback(async () => {
    try {
      const source = data ?? (url ? await loadPdfBytes(url) : null);
      if (!source) throw new Error("No PDF to export");
      const bytes = await applyAnnotationsToPdf(source, annotations);
      await downloadPdfBytes(bytes, fileName.replace(/\.pdf$/i, "") + "-annotated.pdf");
      toast.success("Annotated PDF downloaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    }
  }, [annotations, data, url, fileName]);

  const toolBtn = (t: EditorTool, icon: React.ReactNode, label: string) => (
    <Button
      variant={tool === t ? "default" : "ghost"}
      size="sm"
      className="h-8 gap-1"
      onClick={() => setTool(t)}
      title={label}
    >
      {icon}
      <span className="hidden sm:inline text-xs">{label}</span>
    </Button>
  );

  return (
    <div className={cn("flex flex-col h-full", className)}>
      <div className="flex flex-wrap items-center gap-1 p-2 bg-card border rounded-t-md shrink-0">
        {toolBtn("select", <PenLine className="h-3.5 w-3.5" />, "Select")}
        {toolBtn("highlight", <Highlighter className="h-3.5 w-3.5" />, "Highlight")}
        {toolBtn("text", <Type className="h-3.5 w-3.5" />, "Text")}
        {toolBtn("note", <MessageSquare className="h-3.5 w-3.5" />, "Note")}
        {toolBtn("stamp", <Stamp className="h-3.5 w-3.5" />, "Stamp")}
        {tool === "stamp" && (
          <Input value={stampText} onChange={(e) => setStampText(e.target.value)} className="h-8 w-28 text-xs" />
        )}
        <Separator orientation="vertical" className="h-6 mx-1" />
        <Button variant="secondary" size="sm" className="h-8" onClick={handleExport}>
          <Save className="h-3.5 w-3.5 mr-1" /> Export
        </Button>
        <Button variant="ghost" size="sm" className="h-8 text-destructive" onClick={clearAnnotations}>
          <Trash2 className="h-3.5 w-3.5 mr-1" /> Clear
        </Button>
        <span className="text-xs text-muted-foreground ml-auto">{annotations.length} annotation(s)</span>
      </div>

      <div className="flex-1 min-h-0">
        <PdfViewer
          url={url}
          data={data}
          fileName={fileName}
          className="h-full rounded-t-none"
          onPageDimensions={(w, h, pageIndex) => {
            setPageDims({ width: w, height: h, pageIndex });
          }}
          onScaleChange={setScale}
          overlay={
            <div
              ref={containerRef}
              className="absolute inset-0"
              style={{ cursor: tool !== "select" ? "crosshair" : "default" }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            >
              {pageAnnotations.map((ann) => (
                <div
                  key={ann.id}
                  className={cn(
                    "absolute border group",
                    ann.type === "highlight" && "bg-yellow-300/40 border-yellow-400/50",
                    ann.type === "stamp" && "border-red-400 text-red-600 font-bold text-lg flex items-center justify-center opacity-70",
                    (ann.type === "text" || ann.type === "note") && "bg-white/80 border-gray-300 text-xs p-1"
                  )}
                  style={{
                    left: ann.x * scale,
                    top: ann.y * scale,
                    width: ann.width * scale,
                    height: ann.height * scale,
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (tool === "select") removeAnnotation(ann.id);
                  }}
                >
                  {ann.type === "stamp" && (ann.content || "APPROVED")}
                  {(ann.type === "text" || ann.type === "note") && ann.content}
                </div>
              ))}
              {draftRect && (
                <div
                  className="absolute border-2 border-dashed border-primary bg-primary/10"
                  style={{
                    left: draftRect.x * scale,
                    top: draftRect.y * scale,
                    width: draftRect.w * scale,
                    height: draftRect.h * scale,
                  }}
                />
              )}
            </div>
          }
        />
      </div>
    </div>
  );
}
