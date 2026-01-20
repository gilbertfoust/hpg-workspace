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
  { value: "Draft", label: "Draft", chipStatus: "draft" },
  { value: "Not Started", label: "Not Started", chipStatus: "not-started" },
  { value: "In Progress", label: "In Progress", chipStatus: "in-progress" },
  { value: "Waiting on NGO", label: "Waiting on NGO", chipStatus: "waiting-ngo" },
  { value: "Waiting on HPG", label: "Waiting on HPG", chipStatus: "waiting-hpg" },
  { value: "Submitted", label: "Submitted", chipStatus: "submitted" },
  { value: "Under Review", label: "Under Review", chipStatus: "under-review" },
  { value: "Approved", label: "Approved", chipStatus: "approved" },
  { value: "Rejected", label: "Rejected", chipStatus: "rejected" },
  { value: "Complete", label: "Complete", chipStatus: "complete" },
  { value: "Canceled", label: "Canceled", chipStatus: "canceled" },
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
