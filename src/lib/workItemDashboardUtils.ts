import type { ModuleType } from "@/hooks/useWorkItems";
import { MODULE_TO_DEPARTMENT_MAP } from "@/utils/moduleToDepartment";

const normalizeToken = (value: string | null | undefined) =>
  (value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");

export const CLOSED_WORK_ITEM_STATUSES = new Set([
  "complete",
  "completed",
  "canceled",
  "cancelled",
]);

export const isOpenDashboardWorkItem = (status: string | null | undefined) =>
  !CLOSED_WORK_ITEM_STATUSES.has(normalizeToken(status));

export const resolveWorkItemDepartmentLabel = (
  departmentId: string | null | undefined,
  module: string | null | undefined,
  departmentMap: Map<string, string>,
) => {
  if (departmentId) {
    const mapped = departmentMap.get(departmentId);
    if (mapped) return mapped;
  }

  if (module) {
    const moduleKey = module as ModuleType;
    const mapping = MODULE_TO_DEPARTMENT_MAP[moduleKey];
    if (mapping?.department_name) {
      return mapping.sub_department_name
        ? `${mapping.department_name} — ${mapping.sub_department_name}`
        : mapping.department_name;
    }
    return module.replace(/_/g, " ");
  }

  return "Unassigned";
};

export type DashboardEvidenceCategory =
  | "missing"
  | "uploaded_pending_review"
  | "under_review"
  | "rejected";

export const EVIDENCE_CATEGORY_LABELS: Record<DashboardEvidenceCategory, string> = {
  missing: "Evidence required — not uploaded",
  uploaded_pending_review: "Evidence uploaded — pending review",
  under_review: "Evidence under review",
  rejected: "Evidence rejected — resubmit",
};

export const classifyEvidenceCategory = (
  evidenceRequired: boolean | null | undefined,
  evidenceStatus: string | null | undefined,
): DashboardEvidenceCategory | null => {
  if (!evidenceRequired) return null;

  const normalized = normalizeToken(evidenceStatus);
  if (normalized === "approved") return null;
  if (normalized === "uploaded") return "uploaded_pending_review";
  if (normalized === "under_review") return "under_review";
  if (normalized === "rejected") return "rejected";
  return "missing";
};

export const evidenceCategoryLabel = (category: DashboardEvidenceCategory) =>
  EVIDENCE_CATEGORY_LABELS[category];
