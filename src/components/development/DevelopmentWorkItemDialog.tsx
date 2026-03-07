import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useCreateWorkItem, Priority } from "@/hooks/useWorkItems";
import { useOrgUnits } from "@/hooks/useOrgUnits";
import { useInternalUsers } from "@/hooks/useProfiles";

interface DevelopmentWorkItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTitle: string;
  workItemType: string;
  ngoId?: string | null;
  module: "development";
}

const priorities: Priority[] = ["low", "medium", "high"];

export function DevelopmentWorkItemDialog({
  open,
  onOpenChange,
  defaultTitle,
  workItemType,
  ngoId,
  module,
}: DevelopmentWorkItemDialogProps) {
  const createWorkItem = useCreateWorkItem();
  const { data: orgUnits } = useOrgUnits();
  const { data: internalUsers } = useInternalUsers();

  const defaultDepartmentId = useMemo(
    () => orgUnits?.find((unit) => unit.department_name.toLowerCase().includes("development"))?.id,
    [orgUnits],
  );

  const [title, setTitle] = useState(defaultTitle);
  const [ownerId, setOwnerId] = useState<string>("");
  const [departmentId, setDepartmentId] = useState<string>("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [dueDate, setDueDate] = useState<string>("");
  const [evidenceRequired, setEvidenceRequired] = useState(false);
  const [approvalRequired, setApprovalRequired] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle(defaultTitle);
      setDepartmentId(defaultDepartmentId || "");
      setOwnerId("");
      setPriority("medium");
      setDueDate("");
      setEvidenceRequired(false);
      setApprovalRequired(false);
    }
  }, [defaultTitle, defaultDepartmentId, open]);

  const handleSubmit = async () => {
    await createWorkItem.mutateAsync({
      title,
      module,
      type: workItemType,
      ngo_id: ngoId || undefined,
      owner_user_id: ownerId || undefined,
      department_id: departmentId || undefined,
      priority,
      due_date: dueDate || undefined,
      evidence_required: evidenceRequired,
      approval_required: approvalRequired,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Development Work Item</DialogTitle>
          <DialogDescription>
            Create a work item linked to this proposal or opportunity.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="development-work-title">Title</Label>
            <Input
              id="development-work-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Owner</Label>
              <Select value={ownerId} onValueChange={setOwnerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Assign owner" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Unassigned</SelectItem>
                  {internalUsers?.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.full_name || user.email || "Unnamed"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Department</Label>
              <Select value={departmentId} onValueChange={setDepartmentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {orgUnits?.map((unit) => (
                    <SelectItem key={unit.id} value={unit.id}>
                      {unit.department_name}
                      {unit.sub_department_name ? ` / ${unit.sub_department_name}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(value) => setPriority(value as Priority)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {priorities.map((value) => (
                    <SelectItem key={value} value={value}>
                      {value.charAt(0).toUpperCase() + value.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="development-work-due">Due date</Label>
              <Input
                id="development-work-due"
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
            <div>
              <p className="text-sm font-medium text-foreground">Evidence required</p>
              <p className="text-xs text-muted-foreground">Attach proof or documentation.</p>
            </div>
            <Switch checked={evidenceRequired} onCheckedChange={setEvidenceRequired} />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
            <div>
              <p className="text-sm font-medium text-foreground">Approval required</p>
              <p className="text-xs text-muted-foreground">Route for internal sign-off.</p>
            </div>
            <Switch checked={approvalRequired} onCheckedChange={setApprovalRequired} />
          </div>
        </div>

        <DialogFooter className="pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!title || createWorkItem.isPending}>
            Create work item
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
