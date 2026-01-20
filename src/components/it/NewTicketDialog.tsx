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
import { priorityOptions, ticketStatusOptions } from "@/components/it/itUtils";
import { useCreateITTicket } from "@/hooks/useITTickets";
import type { ITStatus } from "@/hooks/useITStatus";
import type { Priority } from "@/hooks/useWorkItems";

export function NewTicketDialog() {
  const { user } = useAuth();
  const createTicket = useCreateITTicket();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    subject: "",
    description: "",
    reporter_user_id: user?.id || "",
    severity: "medium" as Priority,
    status: "submitted" as ITStatus,
    assigned_to_user_id: "",
    related_ngo_id: "",
  });

  const handleSubmit = async () => {
    if (!form.subject.trim()) return;

    await createTicket.mutateAsync({
      subject: form.subject,
      description: form.description,
      reporter_user_id: form.reporter_user_id || undefined,
      severity: form.severity,
      status: form.status,
      assigned_to_user_id: form.assigned_to_user_id || null,
      related_ngo_id: form.related_ngo_id || null,
    });

    setOpen(false);
    setForm({
      subject: "",
      description: "",
      reporter_user_id: user?.id || "",
      severity: "medium",
      status: "submitted",
      assigned_to_user_id: "",
      related_ngo_id: "",
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Plus className="w-4 h-4 mr-2" />
          New Ticket
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>New Support Ticket</DialogTitle>
          <DialogDescription>
            Log a new IT support issue so it can be triaged and tracked.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                value={form.subject}
                onChange={(event) => setForm((prev) => ({ ...prev, subject: event.target.value }))}
                placeholder="Short summary"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="severity">Severity</Label>
              <Select
                value={form.severity}
                onValueChange={(value) =>
                  setForm((prev) => ({ ...prev, severity: value as Priority }))
                }
              >
                <SelectTrigger id="severity">
                  <SelectValue placeholder="Select severity" />
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
              <Label htmlFor="reporter">Reporter User ID</Label>
              <Input
                id="reporter"
                value={form.reporter_user_id}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, reporter_user_id: event.target.value }))
                }
                placeholder="Reporter ID"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="assigned">Assigned To</Label>
              <Input
                id="assigned"
                value={form.assigned_to_user_id}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, assigned_to_user_id: event.target.value }))
                }
                placeholder="Assignee ID"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="related_ngo">Related NGO ID</Label>
              <Input
                id="related_ngo"
                value={form.related_ngo_id}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, related_ngo_id: event.target.value }))
                }
                placeholder="Optional NGO ID"
              />
            </div>
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
                  {ticketStatusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={form.description}
              onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
              placeholder="Describe the issue"
              rows={4}
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSubmit} disabled={createTicket.isPending || !form.subject.trim()}>
            Create Ticket
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
