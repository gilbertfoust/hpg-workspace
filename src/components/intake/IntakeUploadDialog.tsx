import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNGOs } from "@/hooks/useNGOs";
import { useDocumentIntake } from "@/hooks/useDocumentIntake";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Upload, Loader2 } from "lucide-react";

const INTAKE_TYPES = [
  { value: "receipt", label: "Receipt" },
  { value: "donation", label: "Donation" },
  { value: "grant_award", label: "Grant Award" },
  { value: "vendor_invoice", label: "Vendor Invoice" },
  { value: "reimbursement", label: "Reimbursement" },
  { value: "other", label: "Other" },
];

interface IntakeUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedNgoId?: string;
}

export function IntakeUploadDialog({ open, onOpenChange, preselectedNgoId }: IntakeUploadDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: ngos } = useNGOs();
  const { create } = useDocumentIntake();
  const [ngoId, setNgoId] = useState(preselectedNgoId || "");
  const [type, setType] = useState("receipt");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleSubmit = async () => {
    if (!ngoId || !file) {
      toast({ variant: "destructive", title: "Missing fields", description: "Select an NGO and file." });
      return;
    }

    setUploading(true);
    try {
      const filePath = `${ngoId}/${Date.now()}_${file.name}`;
      const { error: uploadErr } = await supabase.storage
        .from("intake-documents")
        .upload(filePath, file);
      if (uploadErr) throw uploadErr;

      const submission = await create.mutateAsync({
        ngo_id: ngoId,
        type,
        status: "submitted",
        file_path: filePath,
        file_name: file.name,
        submitted_by_user_id: user?.id || null,
        reviewer_user_id: null,
        reviewer_notes: null,
        fiscal_period_id: null,
      });

      // Trigger AI extraction
      try {
        await supabase.functions.invoke("process-intake-document", {
          body: { intakeId: submission.id },
        });
      } catch (aiErr) {
        console.error("AI extraction failed, submission saved:", aiErr);
        toast({ title: "Uploaded", description: "File saved. AI extraction may still be processing." });
      }

      toast({ title: "Document submitted", description: "File uploaded and extraction started." });
      onOpenChange(false);
      setFile(null);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Upload failed", description: err.message });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Financial Document</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>NGO</Label>
            <Select value={ngoId} onValueChange={setNgoId}>
              <SelectTrigger><SelectValue placeholder="Select NGO" /></SelectTrigger>
              <SelectContent>
                {ngos?.map((n) => (
                  <SelectItem key={n.id} value={n.id}>
                    {n.common_name || n.legal_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Document Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {INTAKE_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>File</Label>
            <Input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.csv,.txt,.xlsx"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={uploading || !ngoId || !file}>
            {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
            Upload & Extract
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
