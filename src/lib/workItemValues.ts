import type { Priority, WorkItem, WorkItemStatus } from "@/hooks/useWorkItems";

export type DbWorkItemStatus =
  | "Draft"
  | "Not Started"
  | "In Progress"
  | "Waiting on NGO"
  | "Waiting on HPG"
  | "Submitted"
  | "Under Review"
  | "Approved"
  | "Rejected"
  | "Complete"
  | "Canceled";

export type DbWorkItemPriority = "Low" | "Med" | "High";

const STATUS_TO_DB: Record<WorkItemStatus, DbWorkItemStatus> = {
  draft: "Draft",
  not_started: "Not Started",
  in_progress: "In Progress",
  waiting_on_ngo: "Waiting on NGO",
  waiting_on_hpg: "Waiting on HPG",
  submitted: "Submitted",
  under_review: "Under Review",
  approved: "Approved",
  rejected: "Rejected",
  complete: "Complete",
  canceled: "Canceled",
};

const STATUS_FROM_DB: Record<string, WorkItemStatus> = Object.fromEntries(
  Object.entries(STATUS_TO_DB).map(([app, db]) => [db, app as WorkItemStatus]),
) as Record<string, WorkItemStatus>;

const PRIORITY_TO_DB: Record<Priority, DbWorkItemPriority> = {
  low: "Low",
  medium: "Med",
  high: "High",
  urgent: "High",
};

const PRIORITY_FROM_DB: Record<string, Priority> = {
  Low: "low",
  Med: "medium",
  High: "high",
};

const DB_STATUSES = new Set<string>(Object.values(STATUS_TO_DB));
const DB_PRIORITIES = new Set<string>(Object.values(PRIORITY_TO_DB));

export function toDbWorkItemStatus(
  value: string | WorkItemStatus | DbWorkItemStatus | null | undefined,
): DbWorkItemStatus | undefined {
  if (!value) return undefined;

  const normalized = String(value).trim();
  if (DB_STATUSES.has(normalized)) {
    return normalized as DbWorkItemStatus;
  }

  const snake = normalized.toLowerCase().replace(/[\s-]+/g, "_") as WorkItemStatus;
  if (snake in STATUS_TO_DB) {
    return STATUS_TO_DB[snake];
  }

  return undefined;
}

export function fromDbWorkItemStatus(
  value: string | WorkItemStatus | DbWorkItemStatus | null | undefined,
): WorkItemStatus {
  if (!value) return "not_started";

  const normalized = String(value).trim();
  if (normalized in STATUS_FROM_DB) {
    return STATUS_FROM_DB[normalized];
  }

  const snake = normalized.toLowerCase().replace(/[\s-]+/g, "_");
  if (snake in STATUS_TO_DB) {
    return snake as WorkItemStatus;
  }

  return "not_started";
}

export function toDbWorkItemPriority(
  value: string | Priority | DbWorkItemPriority | null | undefined,
): DbWorkItemPriority | undefined {
  if (!value) return undefined;

  const normalized = String(value).trim();
  if (DB_PRIORITIES.has(normalized)) {
    return normalized as DbWorkItemPriority;
  }

  const key = normalized.toLowerCase() as Priority;
  if (key in PRIORITY_TO_DB) {
    return PRIORITY_TO_DB[key];
  }

  return undefined;
}

export function fromDbWorkItemPriority(
  value: string | Priority | DbWorkItemPriority | null | undefined,
): Priority {
  if (!value) return "medium";

  const normalized = String(value).trim();
  if (normalized in PRIORITY_FROM_DB) {
    return PRIORITY_FROM_DB[normalized];
  }

  const key = normalized.toLowerCase() as Priority;
  if (key in PRIORITY_TO_DB) {
    return key;
  }

  return "medium";
}

export function normalizeWorkItem<T extends Partial<WorkItem>>(row: T): T {
  return {
    ...row,
    status: row.status ? fromDbWorkItemStatus(row.status) : row.status,
    priority: row.priority ? fromDbWorkItemPriority(row.priority) : row.priority,
  };
}

export function prepareWorkItemForDb<T extends Record<string, unknown>>(payload: T): T {
  const prepared = { ...payload };

  if ("status" in prepared && prepared.status != null) {
    const dbStatus = toDbWorkItemStatus(prepared.status as string);
    if (dbStatus) prepared.status = dbStatus;
  }

  if ("priority" in prepared && prepared.priority != null) {
    const dbPriority = toDbWorkItemPriority(prepared.priority as string);
    if (dbPriority) prepared.priority = dbPriority;
  }

  return prepared;
}
