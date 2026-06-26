import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { initPdfWorker, pdfjs } from "@/lib/pdf/pdfWorker";
import { downloadPdfBytes, loadPdfBytes } from "@/lib/pdf/pdfDocument";
import type { PdfSearchMatch } from "@/types/pdf";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  Maximize,
  Minimize,
  PanelLeft,
  Printer,
  RotateCw,
  Search,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { toast } from "sonner";

export type PdfFitMode = "width" | "page" | "custom";

export interface PdfViewerProps {
  url?: string;
  data?: ArrayBuffer | Uint8Array;
  fileName?: string;
  className?: string;
  initialPage?: number;
  showToolbar?: boolean;
  showThumbnails?: boolean;
  overlay?: ReactNode;
  onPageDimensions?: (width: number, height: number, pageIndex: number) => void;
  onDocumentLoad?: (pageCount: number) => void;
  onScaleChange?: (scale: number) => void;
}

export function PdfViewer({
  url,
  data,
  fileName = "document.pdf",
  className,
  initialPage = 1,
  showToolbar = true,
  showThumbnails: defaultShowThumbnails = false,
  overlay,
  onPageDimensions,
  onDocumentLoad,
  onScaleChange,
}: PdfViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pdfDocRef = useRef<pdfjs.PDFDocumentProxy | null>(null);
  const pdfBytesRef = useRef<Uint8Array | null>(null);
  const renderTaskRef = useRef<pdfjs.RenderTask | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [fitMode, setFitMode] = useState<PdfFitMode>("width");
  const [thumbnailsOpen, setThumbnailsOpen] = useState(defaultShowThumbnails);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMatches, setSearchMatches] = useState<PdfSearchMatch[]>([]);
  const [matchIndex, setMatchIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [pageSize, setPageSize] = useState({ width: 612, height: 792 });
  const [thumbUrls, setThumbUrls] = useState<string[]>([]);

  const loadDocument = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      initPdfWorker();
      const bytes = data ? await loadPdfBytes(data) : url ? await loadPdfBytes(url) : null;
      if (!bytes) throw new Error("No PDF source provided");

      pdfBytesRef.current = bytes;
      const task = pdfjs.getDocument({ data: bytes.slice() });
      const doc = await task.promise;
      pdfDocRef.current = doc;
      setPageCount(doc.numPages);
      onDocumentLoad?.(doc.numPages);

      const thumbs: string[] = [];
      for (let i = 1; i <= Math.min(doc.numPages, 50); i++) {
        const page = await doc.getPage(i);
        const viewport = page.getViewport({ scale: 0.2, rotation: 0 });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d")!;
        await page.render({ canvasContext: ctx, viewport }).promise;
        thumbs.push(canvas.toDataURL());
      }
      setThumbUrls(thumbs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load PDF");
    } finally {
      setLoading(false);
    }
  }, [url, data, onDocumentLoad]);

  useEffect(() => {
    loadDocument();
    return () => {
      pdfDocRef.current?.destroy();
      renderTaskRef.current?.cancel();
    };
  }, [loadDocument]);

  const computeFitScale = useCallback(
    (page: pdfjs.PDFPageProxy) => {
      const baseViewport = page.getViewport({ scale: 1, rotation });
      const container = containerRef.current;
      if (!container) return 1;
      const padding = thumbnailsOpen ? 220 : 40;
      const availW = container.clientWidth - padding;
      const availH = container.clientHeight - 80;
      if (fitMode === "page") {
        return Math.min(availW / baseViewport.width, availH / baseViewport.height);
      }
      return availW / baseViewport.width;
    },
    [fitMode, rotation, thumbnailsOpen]
  );

  const renderPage = useCallback(async () => {
    const doc = pdfDocRef.current;
    const canvas = canvasRef.current;
    if (!doc || !canvas) return;

    try {
      renderTaskRef.current?.cancel();
      const page = await doc.getPage(currentPage);
      const fitScale = fitMode === "custom" ? scale : computeFitScale(page);
      const viewport = page.getViewport({ scale: fitScale, rotation });
      const ctx = canvas.getContext("2d")!;

      canvas.width = viewport.width;
      canvas.height = viewport.height;
      setPageSize({ width: viewport.width / fitScale, height: viewport.height / fitScale });

      if (fitMode !== "custom") setScale(fitScale);
      onScaleChange?.(fitScale);

      const task = page.render({ canvasContext: ctx, viewport });
      renderTaskRef.current = task;
      await task.promise;

      onPageDimensions?.(viewport.width / fitScale, viewport.height / fitScale, currentPage - 1);
    } catch (err) {
      if ((err as Error)?.name !== "RenderingCancelledException") {
        console.error("PDF render error:", err);
      }
    }
  }, [currentPage, scale, rotation, fitMode, computeFitScale, onPageDimensions, onScaleChange]);

  useEffect(() => {
    if (!loading && pdfDocRef.current) renderPage();
  }, [loading, renderPage]);

  useEffect(() => {
    const onResize = () => renderPage();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [renderPage]);

  const runSearch = useCallback(async () => {
    const doc = pdfDocRef.current;
    if (!doc || !searchQuery.trim()) {
      setSearchMatches([]);
      return;
    }
    const q = searchQuery.toLowerCase();
    const matches: PdfSearchMatch[] = [];

    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const text = content.items.map((item) => ("str" in item ? item.str : "")).join(" ");
      let idx = text.toLowerCase().indexOf(q);
      while (idx !== -1) {
        matches.push({ pageIndex: i - 1, text: text.slice(idx, idx + q.length), index: idx });
        idx = text.toLowerCase().indexOf(q, idx + 1);
      }
    }
    setSearchMatches(matches);
    setMatchIndex(0);
    if (matches.length > 0) setCurrentPage(matches[0].pageIndex + 1);
    else toast.info("No matches found");
  }, [searchQuery]);

  const goToMatch = (dir: 1 | -1) => {
    if (!searchMatches.length) return;
    const next = (matchIndex + dir + searchMatches.length) % searchMatches.length;
    setMatchIndex(next);
    setCurrentPage(searchMatches[next].pageIndex + 1);
  };

  const handleDownload = async () => {
    if (pdfBytesRef.current) {
      await downloadPdfBytes(pdfBytesRef.current, fileName);
      return;
    }
    if (url) {
      const bytes = await loadPdfBytes(url);
      await downloadPdfBytes(bytes, fileName);
    }
  };

  const handlePrint = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<html><head><title>${fileName}</title></head><body style="margin:0;text-align:center;"><img src="${canvas.toDataURL()}" style="max-width:100%;" /></body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => {
      w.print();
      w.close();
    }, 400);
  };

  const toggleFullscreen = async () => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      await el.requestFullscreen();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  if (loading) {
    return (
      <div className={cn("flex items-center justify-center h-64 bg-muted/20 rounded-md", className)}>
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("flex items-center justify-center h-64 bg-destructive/5 text-destructive rounded-md p-4", className)}>
        {error}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn("flex flex-col h-full min-h-[400px] bg-muted/30 rounded-md border overflow-hidden", className)}
    >
      {showToolbar && (
        <div className="flex flex-wrap items-center gap-1 p-2 bg-card border-b shrink-0">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setThumbnailsOpen((v) => !v)} title="Thumbnails">
            <PanelLeft className="h-4 w-4" />
          </Button>
          <Separator orientation="vertical" className="h-6 mx-1" />
          <Button variant="ghost" size="icon" className="h-8 w-8" disabled={currentPage <= 1} onClick={() => setCurrentPage((p) => p - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-1 text-sm">
            <Input
              className="h-8 w-12 text-center px-1"
              value={currentPage}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10);
                if (!isNaN(n)) setCurrentPage(Math.max(1, Math.min(pageCount, n)));
              }}
            />
            <span className="text-muted-foreground">/ {pageCount}</span>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" disabled={currentPage >= pageCount} onClick={() => setCurrentPage((p) => p + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Separator orientation="vertical" className="h-6 mx-1" />
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setFitMode("custom"); setScale((s) => Math.max(0.25, s - 0.15)); }}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground w-10 text-center">{Math.round(scale * 100)}%</span>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setFitMode("custom"); setScale((s) => Math.min(3, s + 0.15)); }}>
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setFitMode("width")}>Fit Width</Button>
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setFitMode("page")}>Fit Page</Button>
          <Separator orientation="vertical" className="h-6 mx-1" />
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setRotation((r) => (r + 90) % 360)} title="Rotate">
            <RotateCw className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSearchOpen((v) => !v)} title="Search">
            <Search className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handlePrint} title="Print">
            <Printer className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleDownload} title="Download">
            <Download className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggleFullscreen} title="Fullscreen">
            {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </Button>
        </div>
      )}

      {searchOpen && (
        <div className="flex items-center gap-2 p-2 bg-card border-b shrink-0">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input
            placeholder="Search in document..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runSearch()}
            className="h-8"
          />
          <Button size="sm" variant="secondary" onClick={runSearch}>Find</Button>
          {searchMatches.length > 0 && (
            <>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {matchIndex + 1} of {searchMatches.length}
              </span>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => goToMatch(-1)}><ChevronLeft className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => goToMatch(1)}><ChevronRight className="h-4 w-4" /></Button>
            </>
          )}
          <Button size="icon" variant="ghost" className="h-7 w-7 ml-auto" onClick={() => setSearchOpen(false)}><X className="h-4 w-4" /></Button>
        </div>
      )}

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {thumbnailsOpen && (
          <ScrollArea className="w-36 shrink-0 border-r bg-card">
            <div className="p-2 space-y-2">
              {thumbUrls.map((src, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setCurrentPage(i + 1)}
                  className={cn(
                    "w-full rounded border p-1 hover:border-primary transition-colors",
                    currentPage === i + 1 && "border-primary ring-1 ring-primary"
                  )}
                >
                  <img src={src} alt={`Page ${i + 1}`} className="w-full" />
                  <p className="text-[10px] text-center mt-1 text-muted-foreground">{i + 1}</p>
                </button>
              ))}
            </div>
          </ScrollArea>
        )}

        <ScrollArea className="flex-1">
          <div className="flex justify-center p-4 min-h-full">
            <div className="relative shadow-lg bg-white" style={{ width: canvasRef.current?.width, height: canvasRef.current?.height }}>
              <canvas ref={canvasRef} className="block" />
              {overlay && (
                <div className="absolute inset-0" style={{ width: "100%", height: "100%" }}>
                  {overlay}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </div>

      {fitMode === "custom" && (
        <div className="px-4 py-2 border-t bg-card shrink-0">
          <Slider
            value={[scale * 100]}
            min={25}
            max={300}
            step={5}
            onValueChange={([v]) => { setFitMode("custom"); setScale(v / 100); }}
          />
        </div>
      )}
    </div>
  );
}
