import type { AppRole, UserRole } from "@/hooks/useUserRole";
import {
  ADMIN_ROLES,
  DEPARTMENT_LEAD_ROLES,
  isAdminRole,
  isDepartmentLeadRole,
  isNgoPortalRole,
  isStaffWorkspaceRole,
  isVpRole,
  VP_ROLES,
} from "@/hooks/useUserRole";

export type AccessArea =
  | "dashboard"
  | "ngos"
  | "ngo_portal"
  | "work_items"
  | "documents"
  | "finance"
  | "hr"
  | "grants"
  | "reports"
  | "admin"
  | "calendar"
  | "development"
  | "communications"
  | "it"
  | "program"
  | "compliance";

export interface RoleDefinition {
  key: AppRole;
  label: string;
  summary: string;
}

/** Canonical role matrix aligned with product access lanes. */
export const ROLE_DEFINITIONS: RoleDefinition[] = [
  { key: "super_admin", label: "Super Admin", summary: "Full platform access including user role assignment." },
  { key: "admin_pm", label: "Admin", summary: "Admin console, configuration, and cross-department operations." },
  { key: "vp_operations", label: "VP Operations", summary: "Executive operations dashboard and department oversight." },
  { key: "vp_programs", label: "VP Programs", summary: "Program and NGO portfolio oversight." },
  { key: "vp_development", label: "VP Development", summary: "Grants, development pipeline, and sponsee outreach." },
  { key: "vp_finance", label: "VP Finance", summary: "Financial hub, controller tools, and finance reports." },
  { key: "vp_communications", label: "VP Communications", summary: "Communications hub and marketing workflows." },
  { key: "department_lead", label: "Department Lead", summary: "Department queue, team work items, and approvals." },
  { key: "ngo_coordinator", label: "NGO Coordinator", summary: "NGO coordination queue, onboarding, and document intake." },
  { key: "executive_secretariat", label: "Executive Secretariat", summary: "Administration workflows and executive support." },
  { key: "staff", label: "Staff", summary: "Day-to-day workspace access for assigned modules." },
  { key: "staff_member", label: "Staff Member", summary: "Day-to-day workspace access for assigned modules." },
  { key: "ngo_user", label: "NGO User", summary: "NGO portal only — submissions, documents, and status." },
  { key: "external_ngo", label: "External NGO", summary: "NGO portal only — limited partner access." },
  { key: "viewer", label: "Viewer / Board", summary: "Read-only dashboards and reports." },
  { key: "board", label: "Board", summary: "Read-only dashboards and reports." },
];

const ALL_STAFF_AREAS: AccessArea[] = [
  "dashboard",
  "ngos",
  "work_items",
  "documents",
  "finance",
  "hr",
  "grants",
  "reports",
  "calendar",
  "development",
];

const VIEWER_AREAS: AccessArea[] = ["dashboard", "reports"];

const COMMON_STAFF_AREAS: AccessArea[] = [
  "dashboard",
  "work_items",
  "documents",
  "reports",
  "calendar",
];

const ROLE_AREA_MATRIX: Record<string, AccessArea[] | "all"> = {
  super_admin: "all",
  admin_pm: "all",
  vp_operations: ALL_STAFF_AREAS,
  vp_programs: ["dashboard", "ngos", "work_items", "documents", "grants", "reports", "calendar", "program"],
  vp_development: ["dashboard", "ngos", "work_items", "documents", "grants", "reports", "calendar", "development"],
  vp_finance: ["dashboard", "work_items", "documents", "finance", "reports", "calendar"],
  vp_communications: ["dashboard", "ngos", "work_items", "documents", "reports", "calendar", "communications"],
  department_lead: ALL_STAFF_AREAS,
  ngo_coordinator: ["dashboard", "ngos", "work_items", "documents", "calendar"],
  executive_secretariat: ALL_STAFF_AREAS,
  staff: ALL_STAFF_AREAS,
  staff_member: ALL_STAFF_AREAS,
  ngo_user: ["ngo_portal"],
  external_ngo: ["ngo_portal"],
  viewer: VIEWER_AREAS,
  board: VIEWER_AREAS,
};

const ROUTE_AREA_PREFIXES: { prefix: string; area: AccessArea }[] = [
  { prefix: "/portal", area: "ngo_portal" },
  { prefix: "/admin", area: "admin" },
  { prefix: "/financial-hub/compliance", area: "compliance" },
  { prefix: "/financial-hub", area: "finance" },
  { prefix: "/procurement", area: "development" },
  { prefix: "/assets", area: "finance" },
  { prefix: "/inventory", area: "finance" },
  { prefix: "/revenue", area: "development" },
  { prefix: "/controller", area: "finance" },
  { prefix: "/governance", area: "compliance" },
  { prefix: "/hr", area: "hr" },
  { prefix: "/erp/hr", area: "hr" },
  { prefix: "/grants", area: "development" },
  { prefix: "/crm", area: "development" },
  { prefix: "/partnerships", area: "development" },
  { prefix: "/development", area: "development" },
  { prefix: "/modules/development", area: "development" },
  { prefix: "/modules/communications", area: "communications" },
  { prefix: "/modules/marketing", area: "communications" },
  { prefix: "/it", area: "it" },
  { prefix: "/modules/it", area: "it" },
  { prefix: "/audit", area: "it" },
  { prefix: "/ngo-coordination", area: "program" },
  { prefix: "/ngo-missing-items", area: "program" },
  { prefix: "/program", area: "program" },
  { prefix: "/curriculum", area: "program" },
  { prefix: "/modules/program", area: "program" },
  { prefix: "/modules/curriculum", area: "program" },
  { prefix: "/reports", area: "reports" },
  { prefix: "/documents", area: "documents" },
  { prefix: "/work-items", area: "work_items" },
  { prefix: "/my-queue", area: "work_items" },
  { prefix: "/dept-queue", area: "work_items" },
  { prefix: "/calendar", area: "calendar" },
  { prefix: "/ngos", area: "ngos" },
  { prefix: "/dashboard", area: "dashboard" },
];

const normalizeDepartment = (access?: Pick<UserRole, "department_name" | "sub_department_name"> | null) =>
  `${access?.department_name ?? ""} ${access?.sub_department_name ?? ""}`.trim().toLowerCase();

const departmentAreas = (access?: Pick<UserRole, "department_name" | "sub_department_name"> | null): AccessArea[] => {
  const department = normalizeDepartment(access);
  const areas = new Set<AccessArea>(COMMON_STAFF_AREAS);
  if (department.includes("finance")) areas.add("finance");
  if (department === "hr" || department.includes("human resources")) areas.add("hr");
  if (department.includes("development")) {
    areas.add("development");
    areas.add("grants");
    areas.add("ngos");
  }
  if (department.includes("marketing") || department.includes("communication")) areas.add("communications");
  if (department === "it" || department.includes("information technology")) areas.add("it");
  if (department.includes("compliance") || department.includes("legal") || department.includes("governance")) {
    areas.add("compliance");
  }
  if (department.includes("program") || department.includes("curriculum")) {
    areas.add("program");
    areas.add("grants");
  }
  if (department.includes("ngo coordination")) {
    areas.add("ngos");
    areas.add("program");
  }
  return Array.from(areas);
};

export const getAreasForRole = (
  role?: string | null,
  access?: Pick<UserRole, "department_name" | "sub_department_name"> | null,
): AccessArea[] | "all" => {
  if (!role) return VIEWER_AREAS;
  if (isAdminRole(role)) return "all";
  if (isNgoPortalRole(role)) return ["ngo_portal"];

  const department = normalizeDepartment(access);
  if (department) return departmentAreas(access);

  // Compatibility for staff records that have not yet been assigned a
  // department. Admin should complete the assignment in Access Management.
  return ROLE_AREA_MATRIX[role] ?? COMMON_STAFF_AREAS;
};

export const canAccessArea = (
  role: string | null | undefined,
  area: AccessArea,
  access?: Pick<UserRole, "department_name" | "sub_department_name"> | null,
): boolean => {
  const areas = getAreasForRole(role, access);
  if (areas === "all") return true;
  return areas.includes(area);
};

export const canAccessAdmin = (role?: string | null) => isAdminRole(role);

export const canAssignRoles = (role?: string | null) => role === "super_admin" || role === "admin_pm";

export const canAccessRoute = (
  role: string | null | undefined,
  pathname: string,
  access?: Pick<UserRole, "department_name" | "sub_department_name"> | null,
): boolean => {
  if (!role) return pathname === "/dashboard" || pathname.startsWith("/reports");

  if (isNgoPortalRole(role)) {
    return pathname.startsWith("/portal") || pathname.startsWith("/auth");
  }

  if (pathname.startsWith("/portal")) return false;

  if (pathname.startsWith("/admin")) {
    return canAccessAdmin(role);
  }

  const matched = ROUTE_AREA_PREFIXES.find(({ prefix }) => pathname.startsWith(prefix));
  if (!matched) return isStaffWorkspaceRole(role) || isVpRole(role) || isDepartmentLeadRole(role);

  return canAccessArea(role, matched.area, access);
};

export const canManageNgoPortalAccounts = (
  role?: string | null,
  access?: Pick<UserRole, "department_name" | "org_rank"> | null,
) => {
  if (isAdminRole(role)) return true;
  const department = (access?.department_name ?? "").trim().toLowerCase();
  const managementRanks = ["chief_executive", "executive_vice_president", "vice_president", "director", "manager"];
  return (department === "it" || department === "information technology")
    && managementRanks.includes(access?.org_rank ?? "");
};

export const getRoleLabel = (role?: string | null) =>
  ROLE_DEFINITIONS.find((entry) => entry.key === role)?.label ??
  role?.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ") ??
  "Unassigned";

export const ASSIGNABLE_ROLES = ROLE_DEFINITIONS.map((entry) => ({
  value: entry.key,
  label: entry.label,
}));

/** Roles shown in admin assignment dropdown. */
export const ADMIN_ASSIGNABLE_ROLES = [
  { value: "super_admin", label: "Super Admin" },
  { value: "admin_pm", label: "Admin" },
  { value: "vp_operations", label: "VP Operations" },
  { value: "vp_programs", label: "VP Programs" },
  { value: "vp_development", label: "VP Development" },
  { value: "vp_finance", label: "VP Finance" },
  { value: "vp_communications", label: "VP Communications" },
  { value: "department_lead", label: "Department Lead" },
  { value: "ngo_coordinator", label: "NGO Coordinator" },
  { value: "executive_secretariat", label: "Executive Secretariat" },
  { value: "staff_member", label: "Staff" },
  { value: "external_ngo", label: "NGO User (Portal)" },
  { value: "viewer", label: "Viewer / Board" },
];

export const isInternalWorkspaceRole = (role?: string | null) =>
  isAdminRole(role) ||
  isVpRole(role) ||
  isDepartmentLeadRole(role) ||
  isStaffWorkspaceRole(role) ||
  role === "viewer" ||
  role === "board";

export { ADMIN_ROLES, VP_ROLES, DEPARTMENT_LEAD_ROLES };
