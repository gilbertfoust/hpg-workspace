import type { WorkItemStatus } from "@/hooks/useWorkItems";

export type ITStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "approved"
  | "rejected"
  | "in_progress"
  | "complete";

export const mapITStatusToWorkItemStatus = (status: ITStatus): WorkItemStatus => {
  switch (status) {
    case "draft":
      return "draft";
    case "submitted":
      return "submitted";
    case "under_review":
      return "under_review";
    case "approved":
      return "approved";
    case "rejected":
      return "rejected";
    case "in_progress":
      return "in_progress";
    case "complete":
      return "complete";
    default:
      return "submitted";
  }
};
