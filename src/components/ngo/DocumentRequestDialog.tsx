import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCreateWorkItem } from "@/hooks/useWorkItems";
import type { NGO } from "@/hooks/useNGOs";

interface DocumentRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ngo: NGO | null;
}

const documentOptions = [
  "Bank statement",
  "Registration proof",
  "Program report",
  "Impact narrative",
  "Financial report",
];

export function DocumentRequestDialog({
  open,
  onOpenChange,
  ngo,
}: DocumentRequestDialogProps) {
  const createWorkItem = useCreateWorkItem();
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const [notes, setNotes] = useState("");

  const description = useMemo(() => {
    const list = selectedDocs.length > 0 ? selectedDocs.join(", ") : "None selected";
    const base = `Requested documents: ${list}.`;
    return notes.trim().length > 0 ? `${base}\n\nNotes: ${notes.trim()}` : base;
  }, [notes, selectedDocs]);

  const handleToggle = (value: string) => {
    setSelectedDocs((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value],
    );
  };

  const handleClose = () => {
    if (!createWorkItem.isPending) {
      setSelectedDocs([]);
      setNotes("");
      onOpenChange(false);
    }
  };

  const handleSubmit = async () => {
    if (!ngo || selectedDocs.length === 0) return;

    await createWorkItem.mutateAsync({
      title: `Document Request - ${ngo.common_name || ngo.legal_name}`,
      module: "ngo_coordination",
      type: "Document Request",
      ngo_id: ngo.id,
      description,
      external_visible: true,
    });

    handleClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Request Documents</DialogTitle>
          <DialogDescription>
            Select the documents to request from this NGO. The request will be visible externally.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-3">
            <Label className="text-sm font-medium">Requested categories</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {documentOptions.map((option) => (
                <label key={option} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={selectedDocs.includes(option)}
                    onCheckedChange={() => handleToggle(option)}
                  />
                  <span>{option}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="document-request-notes">Additional notes</Label>
            <Textarea
              id="document-request-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Add any context or deadlines for the request"
              rows={3}
            />
          </div>

          <div className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground whitespace-pre-line">
            {description}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={createWorkItem.isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={selectedDocs.length === 0 || createWorkItem.isPending}>
            {createWorkItem.isPending ? "Requesting..." : "Request Documents"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
