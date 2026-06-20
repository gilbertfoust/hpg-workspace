import type { AppRole } from "@/hooks/useUserRole";
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
  | "development";

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

const ROLE_AREA_MATRIX: Record<string, AccessArea[] | "all"> = {
  super_admin: "all",
  admin_pm: "all",
  vp_operations: ALL_STAFF_AREAS,
  vp_programs: ["dashboard", "ngos", "work_items", "documents", "grants", "reports", "calendar", "development"],
  vp_development: ["dashboard", "ngos", "work_items", "documents", "grants", "reports", "calendar", "development"],
  vp_finance: ["dashboard", "work_items", "documents", "finance", "reports", "calendar"],
  vp_communications: ["dashboard", "ngos", "work_items", "documents", "reports", "calendar"],
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
  { prefix: "/financial-hub", area: "finance" },
  { prefix: "/procurement", area: "finance" },
  { prefix: "/assets", area: "finance" },
  { prefix: "/inventory", area: "finance" },
  { prefix: "/revenue", area: "finance" },
  { prefix: "/controller", area: "finance" },
  { prefix: "/governance", area: "finance" },
  { prefix: "/hr", area: "hr" },
  { prefix: "/development", area: "development" },
  { prefix: "/modules/development", area: "development" },
  { prefix: "/reports", area: "reports" },
  { prefix: "/documents", area: "documents" },
  { prefix: "/work-items", area: "work_items" },
  { prefix: "/my-queue", area: "work_items" },
  { prefix: "/dept-queue", area: "work_items" },
  { prefix: "/calendar", area: "calendar" },
  { prefix: "/ngos", area: "ngos" },
  { prefix: "/dashboard", area: "dashboard" },
];

export const getAreasForRole = (role?: string | null): AccessArea[] | "all" => {
  if (!role) return VIEWER_AREAS;
  return ROLE_AREA_MATRIX[role] ?? ALL_STAFF_AREAS;
};

export const canAccessArea = (role: string | null | undefined, area: AccessArea): boolean => {
  const areas = getAreasForRole(role);
  if (areas === "all") return true;
  return areas.includes(area);
};

export const canAccessAdmin = (role?: string | null) => isAdminRole(role);

export const canAssignRoles = (role?: string | null) => role === "super_admin" || role === "admin_pm";

export const canAccessRoute = (role: string | null | undefined, pathname: string): boolean => {
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

  return canAccessArea(role, matched.area);
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
