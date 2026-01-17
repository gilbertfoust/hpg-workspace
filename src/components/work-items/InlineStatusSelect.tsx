import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusChip } from "@/components/common/StatusChip";
import { useUpdateWorkItem, WorkItemStatus } from "@/hooks/useWorkItems";

const statusOptions: { value: WorkItemStatus; label: string; chipStatus: string }[] = [
  { value: "draft", label: "Draft", chipStatus: "draft" },
  { value: "not_started", label: "Not Started", chipStatus: "not-started" },
  { value: "in_progress", label: "In Progress", chipStatus: "in-progress" },
  { value: "waiting_on_ngo", label: "Waiting on NGO", chipStatus: "waiting-ngo" },
  { value: "waiting_on_hpg", label: "Waiting on HPG", chipStatus: "waiting-hpg" },
  { value: "submitted", label: "Submitted", chipStatus: "submitted" },
  { value: "under_review", label: "Under Review", chipStatus: "under-review" },
  { value: "approved", label: "Approved", chipStatus: "approved" },
  { value: "rejected", label: "Rejected", chipStatus: "rejected" },
  { value: "complete", label: "Complete", chipStatus: "complete" },
  { value: "canceled", label: "Canceled", chipStatus: "canceled" },
];

interface InlineStatusSelectProps {
  workItemId: string;
  currentStatus: WorkItemStatus;
}

export function InlineStatusSelect({ workItemId, currentStatus }: InlineStatusSelectProps) {
  const updateWorkItem = useUpdateWorkItem();

  const handleStatusChange = (newStatus: WorkItemStatus) => {
    if (newStatus !== currentStatus) {
      updateWorkItem.mutate({ id: workItemId, status: newStatus });
    }
  };

  const currentOption = statusOptions.find((s) => s.value === currentStatus);

  return (
    <Select value={currentStatus} onValueChange={handleStatusChange}>
      <SelectTrigger className="w-auto h-auto p-0 border-0 bg-transparent hover:bg-accent rounded">
        <StatusChip
          status={(currentOption?.chipStatus || "draft") as any}
          className="cursor-pointer"
        />
      </SelectTrigger>
      <SelectContent>
        {statusOptions.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            <StatusChip status={option.chipStatus as any} />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}