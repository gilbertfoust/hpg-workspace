import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  accessRequestStatusOptions,
  accessRequestTypeOptions,
  priorityOptions,
} from "@/components/it/itUtils";
import { useCreateITAccessRequest } from "@/hooks/useITAccessRequests";
import type { AccessRequestType } from "@/hooks/useITAccessRequests";
import type { ITStatus } from "@/hooks/useITStatus";
import type { Priority } from "@/hooks/useWorkItems";

export function NewAccessRequestDialog() {
  const { user } = useAuth();
  const createAccessRequest = useCreateITAccessRequest();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    request_type: "Slack" as AccessRequestType,
    target_user: "",
    requested_by_user_id: user?.id || "",
    justification: "",
    priority: "medium" as Priority,
    status: "submitted" as ITStatus,
  });

  const handleSubmit = async () => {
    if (!form.target_user.trim() || !form.justification.trim()) return;

    await createAccessRequest.mutateAsync({
      request_type: form.request_type,
      target_user: form.target_user,
      requested_by_user_id: form.requested_by_user_id || undefined,
      justification: form.justification,
      priority: form.priority,
      status: form.status,
    });

    setOpen(false);
    setForm({
      request_type: "Slack",
      target_user: "",
      requested_by_user_id: user?.id || "",
      justification: "",
      priority: "medium",
      status: "submitted",
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          New Access Request
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>New Access Request</DialogTitle>
          <DialogDescription>
            Submit a new IT access request. Provide justification and target user details.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="request_type">Request Type</Label>
              <Select
                value={form.request_type}
                onValueChange={(value) =>
                  setForm((prev) => ({ ...prev, request_type: value as AccessRequestType }))
                }
              >
                <SelectTrigger id="request_type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {accessRequestTypeOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="target_user">Target User</Label>
              <Input
                id="target_user"
                value={form.target_user}
                onChange={(event) => setForm((prev) => ({ ...prev, target_user: event.target.value }))}
                placeholder="user@hpg.org"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="requested_by">Requested By</Label>
              <Input
                id="requested_by"
                value={form.requested_by_user_id}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, requested_by_user_id: event.target.value }))
                }
                placeholder="User ID"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="priority">Priority / SLA</Label>
              <Select
                value={form.priority}
                onValueChange={(value) =>
                  setForm((prev) => ({ ...prev, priority: value as Priority }))
                }
              >
                <SelectTrigger id="priority">
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  {priorityOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={form.status}
                onValueChange={(value) => setForm((prev) => ({ ...prev, status: value as ITStatus }))}
              >
                <SelectTrigger id="status">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {accessRequestStatusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="justification">Justification</Label>
            <Textarea
              id="justification"
              value={form.justification}
              onChange={(event) => setForm((prev) => ({ ...prev, justification: event.target.value }))}
              placeholder="Explain why this access is needed"
              rows={4}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={handleSubmit}
            disabled={createAccessRequest.isPending || !form.target_user.trim()}
          >
            Submit Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
