import type { ITStatus } from "@/hooks/useITStatus";
import type { Priority } from "@/hooks/useWorkItems";

export const accessRequestStatusOptions: { value: ITStatus; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "submitted", label: "Submitted" },
  { value: "under_review", label: "Under Review" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "in_progress", label: "In Progress" },
  { value: "complete", label: "Complete" },
];

export const ticketStatusOptions = accessRequestStatusOptions;

export const priorityOptions: { value: Priority; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

export const accessRequestTypeOptions = [
  "Slack",
  "Google Workspace",
  "Trello",
  "Drive",
  "Other",
] as const;

export const statusChipMap: Record<
  ITStatus,
  "approved" | "in-progress" | "rejected" | "draft" | "waiting-ngo"
> = {
  draft: "draft",
  submitted: "in-progress",
  under_review: "waiting-ngo",
  approved: "approved",
  rejected: "rejected",
  in_progress: "in-progress",
  complete: "approved",
};

export const getStatusLabel = (status: ITStatus) =>
  accessRequestStatusOptions.find((option) => option.value === status)?.label || status;
