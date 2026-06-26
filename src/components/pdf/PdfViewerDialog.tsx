import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PdfViewer } from "./PdfViewer";

interface PdfViewerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  url?: string;
  data?: ArrayBuffer | Uint8Array;
  fileName?: string;
  title?: string;
}

export function PdfViewerDialog({
  open,
  onOpenChange,
  url,
  data,
  fileName,
  title,
}: PdfViewerDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-[95vw] h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-4 pt-4 pb-2 shrink-0">
          <DialogTitle className="truncate pr-8">{title || fileName || "PDF Viewer"}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 min-h-0 px-4 pb-4">
          {open && (
            <PdfViewer
              url={url}
              data={data}
              fileName={fileName}
              className="h-full"
              showThumbnails
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
