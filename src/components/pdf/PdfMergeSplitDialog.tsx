import { useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { mergePdfs, splitPdf, extractPdfPages } from "@/lib/pdf/pdfMergeSplit";
import { downloadPdfBytes } from "@/lib/pdf/pdfDocument";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

interface PdfMergeSplitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PdfMergeSplitDialog({ open, onOpenChange }: PdfMergeSplitDialogProps) {
  const mergeInputRef = useRef<HTMLInputElement>(null);
  const splitInputRef = useRef<HTMLInputElement>(null);
  const [mergeFiles, setMergeFiles] = useState<File[]>([]);
  const [splitFile, setSplitFile] = useState<File | null>(null);
  const [pageRange, setPageRange] = useState("1-1");
  const [busy, setBusy] = useState(false);

  const handleMerge = async () => {
    if (mergeFiles.length < 2) {
      toast.error("Select at least 2 PDF files to merge");
      return;
    }
    setBusy(true);
    try {
      const buffers = await Promise.all(mergeFiles.map((f) => f.arrayBuffer()));
      const merged = await mergePdfs(buffers);
      await downloadPdfBytes(merged, "merged-document.pdf");
      toast.success("Merged PDF downloaded");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Merge failed");
    } finally {
      setBusy(false);
    }
  };

  const handleSplit = async () => {
    if (!splitFile) {
      toast.error("Select a PDF to split");
      return;
    }
    const match = pageRange.match(/^(\d+)\s*-\s*(\d+)$/);
    if (!match) {
      toast.error("Use format: start-end (e.g. 1-3)");
      return;
    }
    setBusy(true);
    try {
      const buffer = await splitFile.arrayBuffer();
      const start = parseInt(match[1], 10) - 1;
      const end = parseInt(match[2], 10) - 1;
      const parts = await splitPdf(buffer, [{ start, end }]);
      for (let i = 0; i < parts.length; i++) {
        await downloadPdfBytes(parts[i], `split-pages-${match[1]}-${match[2]}.pdf`);
      }
      toast.success("Split PDF downloaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Split failed");
    } finally {
      setBusy(false);
    }
  };

  const handleExtractAll = async () => {
    if (!splitFile) return;
    setBusy(true);
    try {
      const buffer = await splitFile.arrayBuffer();
      const { getPdfPageCount } = await import("@/lib/pdf/pdfDocument");
      const count = await getPdfPageCount(buffer);
      for (let i = 0; i < count; i++) {
        const page = await extractPdfPages(buffer, [i]);
        await downloadPdfBytes(page, `page-${i + 1}.pdf`);
      }
      toast.success(`Extracted ${count} pages`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Extract failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Merge / Split PDF</DialogTitle>
          <DialogDescription>Combine multiple PDFs or extract page ranges.</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="merge">
          <TabsList className="w-full">
            <TabsTrigger value="merge" className="flex-1">Merge</TabsTrigger>
            <TabsTrigger value="split" className="flex-1">Split</TabsTrigger>
          </TabsList>

          <TabsContent value="merge" className="space-y-3 mt-3">
            <input
              ref={mergeInputRef}
              type="file"
              accept=".pdf"
              multiple
              className="hidden"
              onChange={(e) => setMergeFiles(Array.from(e.target.files || []))}
            />
            <Button variant="outline" className="w-full" onClick={() => mergeInputRef.current?.click()}>
              <Upload className="h-4 w-4 mr-2" />
              {mergeFiles.length ? `${mergeFiles.length} file(s) selected` : "Choose PDFs"}
            </Button>
            {mergeFiles.length > 0 && (
              <ul className="text-xs text-muted-foreground space-y-1 max-h-24 overflow-auto">
                {mergeFiles.map((f, i) => (
                  <li key={i} className="truncate">{f.name}</li>
                ))}
              </ul>
            )}
            <DialogFooter>
              <Button onClick={handleMerge} disabled={busy || mergeFiles.length < 2}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Merge & Download
              </Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="split" className="space-y-3 mt-3">
            <input
              ref={splitInputRef}
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={(e) => setSplitFile(e.target.files?.[0] || null)}
            />
            <Button variant="outline" className="w-full" onClick={() => splitInputRef.current?.click()}>
              <Upload className="h-4 w-4 mr-2" />
              {splitFile ? splitFile.name : "Choose PDF"}
            </Button>
            <div className="flex gap-2 items-center">
              <label className="text-sm shrink-0">Pages:</label>
              <input
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={pageRange}
                onChange={(e) => setPageRange(e.target.value)}
                placeholder="1-3"
              />
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={handleExtractAll} disabled={busy || !splitFile}>
                Extract All Pages
              </Button>
              <Button onClick={handleSplit} disabled={busy || !splitFile}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Split & Download
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
