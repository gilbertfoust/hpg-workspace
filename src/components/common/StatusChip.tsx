import { cn } from "@/lib/utils";

type StatusType = 
  | "draft" 
  | "not-started" 
  | "in-progress" 
  | "waiting-ngo" 
  | "waiting-hpg" 
  | "submitted" 
  | "under-review" 
  | "approved" 
  | "rejected" 
  | "complete" 
  | "canceled";

interface StatusChipProps {
  status: StatusType;
  className?: string;
}

const statusLabels: Record<StatusType, string> = {
  "draft": "Draft",
  "not-started": "Not Started",
  "in-progress": "In Progress",
  "waiting-ngo": "Waiting on NGO",
  "waiting-hpg": "Waiting on HPG",
  "submitted": "Submitted",
  "under-review": "Under Review",
  "approved": "Approved",
  "rejected": "Rejected",
  "complete": "Complete",
  "canceled": "Canceled",
};

const statusClasses: Record<StatusType, string> = {
  "draft": "status-draft",
  "not-started": "status-not-started",
  "in-progress": "status-in-progress",
  "waiting-ngo": "status-waiting-ngo",
  "waiting-hpg": "status-waiting-hpg",
  "submitted": "status-submitted",
  "under-review": "status-under-review",
  "approved": "status-approved",
  "rejected": "status-rejected",
  "complete": "status-complete",
  "canceled": "status-canceled",
};

export function StatusChip({ status, className }: StatusChipProps) {
  return (
    <span className={cn("status-chip", statusClasses[status], className)}>
      {statusLabels[status]}
    </span>
  );
}
