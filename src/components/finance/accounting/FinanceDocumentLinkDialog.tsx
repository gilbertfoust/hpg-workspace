import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { FinanceDocumentLinkEntityType } from "@/types/financeAccounting";
import { FINANCE_DOCUMENT_LINK_ENTITY_LABELS } from "@/types/financeAccounting";

interface FinanceDocumentLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: FinanceDocumentLinkEntityType;
  entityId: string;
  entityLabel: string;
  documents: { id: string; file_name: string; category?: string | null }[];
  onLink: (input: { documentId: string; linkNotes?: string }) => Promise<void>;
  isLinking?: boolean;
}

export function FinanceDocumentLinkDialog({
  open,
  onOpenChange,
  entityType,
  entityId,
  entityLabel,
  documents,
  onLink,
  isLinking,
}: FinanceDocumentLinkDialogProps) {
  const [documentId, setDocumentId] = useState("none");
  const [linkNotes, setLinkNotes] = useState("");

  const handleSubmit = async () => {
    if (documentId === "none") return;
    await onLink({ documentId, linkNotes: linkNotes.trim() || undefined });
    setDocumentId("none");
    setLinkNotes("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Link supporting document</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Attach a receipt or supporting document to {FINANCE_DOCUMENT_LINK_ENTITY_LABELS[entityType].toLowerCase()}{" "}
          <span className="font-medium text-foreground">{entityLabel}</span>
        </p>
        <input type="hidden" value={entityId} readOnly />
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Document</Label>
            <Select value={documentId} onValueChange={setDocumentId}>
              <SelectTrigger>
                <SelectValue placeholder="Select document" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Select document</SelectItem>
                {documents.map((doc) => (
                  <SelectItem key={doc.id} value={doc.id}>
                    {doc.file_name}
                    {doc.category ? ` (${doc.category})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="link-notes">Notes</Label>
            <Textarea
              id="link-notes"
              value={linkNotes}
              onChange={(e) => setLinkNotes(e.target.value)}
              placeholder="Optional context for auditors..."
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLinking}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={documentId === "none" || isLinking}>
            Link document
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
