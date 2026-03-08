import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Eye, Download, FileText, Loader2, Paperclip } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface ReceiptViewerProps {
  transactionId: string;
}

const BUCKET = "ledger-receipts";

const isImageFile = (name: string) =>
  /\.(jpg|jpeg|png|webp|gif|bmp|svg)$/i.test(name);

const isPdfFile = (name: string) => /\.pdf$/i.test(name);

export function ReceiptViewer({ transactionId }: ReceiptViewerProps) {
  const { toast } = useToast();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState("");
  const [previewIsImage, setPreviewIsImage] = useState(false);

  const { data: receipts, isLoading } = useQuery({
    queryKey: ["receipts", transactionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("receipts")
        .select("*")
        .eq("transaction_id", transactionId)
        .order("uploaded_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!transactionId,
  });

  const getSignedUrl = async (filePath: string): Promise<string | null> => {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(filePath, 3600);
    if (error) {
      toast({ variant: "destructive", title: "Error accessing file", description: error.message });
      return null;
    }
    return data.signedUrl;
  };

  const handlePreview = async (filePath: string, fileName: string) => {
    const url = await getSignedUrl(filePath);
    if (!url) return;

    if (isImageFile(fileName) || isPdfFile(fileName)) {
      setPreviewUrl(url);
      setPreviewName(fileName);
      setPreviewIsImage(isImageFile(fileName));
    } else {
      window.open(url, "_blank");
    }
  };

  const handleDownload = async (filePath: string, fileName: string) => {
    const url = await getSignedUrl(filePath);
    if (!url) return;
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
        <Loader2 className="h-3 w-3 animate-spin" /> Loading receipts…
      </div>
    );
  }

  if (!receipts || receipts.length === 0) {
    return (
      <div className="text-xs text-muted-foreground flex items-center gap-1.5 py-1">
        <Paperclip className="h-3 w-3" /> No receipts attached
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
          <Paperclip className="h-3 w-3" /> Attached Receipts ({receipts.length})
        </p>
        <div className="space-y-1.5">
          {receipts.map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2"
            >
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{r.file_name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {format(new Date(r.uploaded_at), "MMM d, yyyy h:mm a")}
                  </p>
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => handlePreview(r.file_path, r.file_name)}
                  title="Preview"
                >
                  <Eye className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => handleDownload(r.file_path, r.file_name)}
                  title="Download"
                >
                  <Download className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Dialog open={!!previewUrl} onOpenChange={(open) => !open && setPreviewUrl(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="truncate">{previewName}</DialogTitle>
          </DialogHeader>
          <div className="overflow-auto max-h-[70vh] flex items-center justify-center bg-muted/20 rounded-md">
            {previewIsImage ? (
              <img
                src={previewUrl!}
                alt={previewName}
                className="max-w-full max-h-[68vh] object-contain rounded"
              />
            ) : (
              <iframe
                src={previewUrl!}
                title={previewName}
                className="w-full h-[68vh] rounded"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
