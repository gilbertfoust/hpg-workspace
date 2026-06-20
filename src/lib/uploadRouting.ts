import type { DocumentCategory } from "@/hooks/useDocuments";
import type { ModuleType } from "@/hooks/useWorkItems";
import { MODULE_TO_DEPARTMENT_MAP } from "@/utils/moduleToDepartment";

export type UploadRouteType =
  | "ngo_upload"
  | "internal_department"
  | "compliance"
  | "finance"
  | "hr"
  | "development_grant"
  | "general_admin";

export interface UploadRouteConfig {
  label: string;
  module: ModuleType;
  category: DocumentCategory;
  requiresNgo: boolean;
  requiresDepartment: boolean;
  coordinatorLabel: string;
}

export const UPLOAD_ROUTE_OPTIONS: { value: UploadRouteType; config: UploadRouteConfig }[] = [
  {
    value: "ngo_upload",
    config: {
      label: "NGO Upload",
      module: "ngo_coordination",
      category: "onboarding",
      requiresNgo: true,
      requiresDepartment: false,
      coordinatorLabel: "NGO Coordinator",
    },
  },
  {
    value: "internal_department",
    config: {
      label: "Internal Department Upload",
      module: "administration",
      category: "other",
      requiresNgo: false,
      requiresDepartment: true,
      coordinatorLabel: "Selected department inbox",
    },
  },
  {
    value: "compliance",
    config: {
      label: "Compliance Document",
      module: "legal",
      category: "compliance",
      requiresNgo: false,
      requiresDepartment: false,
      coordinatorLabel: "Legal / Compliance",
    },
  },
  {
    value: "finance",
    config: {
      label: "Finance Document",
      module: "finance",
      category: "finance",
      requiresNgo: false,
      requiresDepartment: false,
      coordinatorLabel: "Finance",
    },
  },
  {
    value: "hr",
    config: {
      label: "HR Document",
      module: "hr",
      category: "hr",
      requiresNgo: false,
      requiresDepartment: false,
      coordinatorLabel: "HR",
    },
  },
  {
    value: "development_grant",
    config: {
      label: "Development / Grant Document",
      module: "development",
      category: "other",
      requiresNgo: false,
      requiresDepartment: false,
      coordinatorLabel: "Development",
    },
  },
  {
    value: "general_admin",
    config: {
      label: "General Admin Document",
      module: "administration",
      category: "other",
      requiresNgo: false,
      requiresDepartment: false,
      coordinatorLabel: "Administration",
    },
  },
];

export const getUploadRouteConfig = (routeType: UploadRouteType): UploadRouteConfig =>
  UPLOAD_ROUTE_OPTIONS.find((option) => option.value === routeType)!.config;

const departmentNameToModule = (): Map<string, ModuleType> => {
  const map = new Map<string, ModuleType>();
  (Object.entries(MODULE_TO_DEPARTMENT_MAP) as [ModuleType, { department_name: string }][]).forEach(
    ([module, { department_name }]) => {
      if (!map.has(department_name)) {
        map.set(department_name, module);
      }
    }
  );
  return map;
};

const deptModuleMap = departmentNameToModule();

export const resolveModuleForDepartment = (
  departmentName: string | null | undefined,
  fallback: ModuleType
): ModuleType => {
  if (!departmentName) return fallback;
  return deptModuleMap.get(departmentName) ?? fallback;
};

export const buildUploadWorkItemTitle = (fileName: string, routeLabel: string) =>
  `Document intake: ${fileName} (${routeLabel})`;

export const buildUploadWorkItemDescription = (params: {
  routeType: UploadRouteType;
  fileName: string;
  routedTo: string;
  ngoName?: string | null;
}) =>
  [
    "Source: file upload",
    `Route: ${params.routeType}`,
    `File: ${params.fileName}`,
    `Routed to: ${params.routedTo}`,
    params.ngoName ? `NGO: ${params.ngoName}` : null,
  ]
    .filter(Boolean)
    .join("\n");
