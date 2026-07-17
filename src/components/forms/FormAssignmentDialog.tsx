import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCreateFormAssignment } from "@/hooks/useFormAssignments";
import type { FormTemplate } from "@/hooks/useFormTemplates";
import { useNGOs } from "@/hooks/useNGOs";

interface FormAssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: FormTemplate | null;
  initialNgoId?: string | null;
}

export function FormAssignmentDialog({ open, onOpenChange, template, initialNgoId }: FormAssignmentDialogProps) {
  const { data: ngos = [] } = useNGOs();
  const createAssignment = useCreateFormAssignment();
  const [ngoId, setNgoId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [instructions, setInstructions] = useState('');

  useEffect(() => {
    if (open) {
      setNgoId(initialNgoId || '');
      setDueDate('');
      setInstructions('');
    }
  }, [open, initialNgoId]);

  const sortedNgos = useMemo(() => ngos.slice().sort((a, b) =>
    (a.common_name || a.legal_name).localeCompare(b.common_name || b.legal_name)
  ), [ngos]);

  const handleAssign = async () => {
    if (!template || !ngoId) return;
    await createAssignment.mutateAsync({
      formTemplateId: template.id,
      ngoId,
      instructions,
      dueAt: dueDate ? new Date(`${dueDate}T23:59:59`).toISOString() : null,
      externalVisible: true,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign {template?.name || 'form'} to an NGO</DialogTitle>
          <DialogDescription>The assignment will appear on the NGO card and in the NGO portal.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>NGO</Label>
            <Select value={ngoId} onValueChange={setNgoId}>
              <SelectTrigger><SelectValue placeholder="Select an NGO" /></SelectTrigger>
              <SelectContent>{sortedNgos.map((ngo) => <SelectItem key={ngo.id} value={ngo.id}>{ngo.common_name || ngo.legal_name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="form-due-date">Due date</Label>
            <Input id="form-due-date" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="form-assignment-instructions">Instructions</Label>
            <Textarea id="form-assignment-instructions" value={instructions} onChange={(event) => setInstructions(event.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleAssign} disabled={!ngoId || !template || createAssignment.isPending}>{createAssignment.isPending ? 'Assigning…' : 'Assign form'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
