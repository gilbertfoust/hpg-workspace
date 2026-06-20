import { useState } from "react";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useCreateCalendarEvent, type CalendarEventType } from "@/hooks/useCalendarEvents";
import { useNGOs } from "@/hooks/useNGOs";
import { useOrgUnits } from "@/hooks/useOrgUnits";

const EVENT_TYPES: { value: CalendarEventType; label: string }[] = [
  { value: "meeting", label: "Meeting" },
  { value: "deadline", label: "Deadline" },
  { value: "birthday", label: "Birthday" },
  { value: "compliance", label: "Compliance" },
  { value: "training", label: "Training" },
  { value: "other", label: "Other" },
];

interface CreateCalendarEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateCalendarEventDialog({ open, onOpenChange }: CreateCalendarEventDialogProps) {
  const [title, setTitle] = useState("");
  const [eventType, setEventType] = useState<CalendarEventType>("meeting");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [description, setDescription] = useState("");
  const [ngoId, setNgoId] = useState<string>("none");
  const [departmentId, setDepartmentId] = useState<string>("none");

  const createEvent = useCreateCalendarEvent();
  const { data: ngos } = useNGOs();
  const { data: orgUnits } = useOrgUnits();

  const reset = () => {
    setTitle("");
    setEventType("meeting");
    setStartsAt("");
    setEndsAt("");
    setDescription("");
    setNgoId("none");
    setDepartmentId("none");
  };

  const handleSubmit = async () => {
    if (!title.trim() || !startsAt) return;

    await createEvent.mutateAsync({
      title: title.trim(),
      event_type: eventType,
      starts_at: new Date(startsAt).toISOString(),
      ends_at: endsAt ? new Date(endsAt).toISOString() : null,
      description: description.trim() || null,
      ngo_id: ngoId === "none" ? null : ngoId,
      department_id: departmentId === "none" ? null : departmentId,
    });

    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add calendar event</DialogTitle>
          <DialogDescription>
            Admins can add meetings, deadlines, birthdays, compliance dates, and training events.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="event-title">Title *</Label>
            <Input id="event-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Event type</Label>
              <Select value={eventType} onValueChange={(v) => setEventType(v as CalendarEventType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="starts-at">Start *</Label>
              <Input
                id="starts-at"
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ends-at">End (optional)</Label>
            <Input
              id="ends-at"
              type="datetime-local"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="event-description">Description</Label>
            <Textarea
              id="event-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Related NGO</Label>
              <Select value={ngoId} onValueChange={setNgoId}>
                <SelectTrigger>
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {ngos?.map((ngo) => (
                    <SelectItem key={ngo.id} value={ngo.id}>
                      {ngo.common_name || ngo.legal_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Department</Label>
              <Select value={departmentId} onValueChange={setDepartmentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {orgUnits?.map((unit) => (
                    <SelectItem key={unit.id} value={unit.id}>
                      {unit.department_name}
                      {unit.sub_department_name ? ` — ${unit.sub_department_name}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={createEvent.isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!title.trim() || !startsAt || createEvent.isPending}>
            {createEvent.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create event"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
