import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Upload, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface ReceiptUploaderProps {
  transactionId: string;
  onUploaded?: () => void;
}

export function ReceiptUploader({ transactionId, onUploaded }: ReceiptUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);

    try {
      const path = `${transactionId}/${Date.now()}_${file.name}`;
      const { error: storageErr } = await supabase.storage.from("ledger-receipts").upload(path, file);
      if (storageErr) throw storageErr;

      const { error: dbErr } = await supabase.from("receipts").insert({
        transaction_id: transactionId,
        file_path: path,
        file_name: file.name,
        uploaded_by_user_id: (await supabase.auth.getUser()).data.user?.id ?? null,
      });
      if (dbErr) throw dbErr;

      toast({ title: "Receipt uploaded" });
      queryClient.invalidateQueries({ queryKey: ["receipts", transactionId] });
      onUploaded?.();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Upload failed", description: err.message });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div>
      <input ref={inputRef} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={handleUpload} />
      <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={uploading}>
        {uploading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
        Attach Receipt
      </Button>
    </div>
  );
}
