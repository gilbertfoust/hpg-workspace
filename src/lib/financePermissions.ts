import type { AppRole } from "@/hooks/useUserRole";
import { isAdminRole } from "@/hooks/useUserRole";

/** Finance ledger permission tiers aligned with Supabase RLS helpers. */
export type FinancePermission =
  | "read_ledger"
  | "manage_ledger"
  | "post_journal"
  | "save_draft"
  | "approve_bill"
  | "void_transaction"
  | "reconcile_bank"
  | "edit_settings"
  | "audit_read";

const FINANCE_MANAGER_ROLES: AppRole[] = ["super_admin", "admin_pm", "vp_finance"];

const FINANCE_READ_ROLES: AppRole[] = [
  ...FINANCE_MANAGER_ROLES,
  "vp_operations",
  "department_lead",
  "executive_secretariat",
  "staff",
  "staff_member",
  "ngo_coordinator",
  "viewer",
  "board",
];

export const isFinanceManager = (role?: string | null) =>
  FINANCE_MANAGER_ROLES.includes(role as AppRole) || isAdminRole(role);

export const canReadFinanceLedger = (role?: string | null) => {
  if (isFinanceManager(role)) return true;
  if (role === "ngo_user" || role === "external_ngo") return false;
  return FINANCE_READ_ROLES.includes(role as AppRole);
};

export const isFinanceStaff = (role?: string | null) =>
  isFinanceManager(role) || role === "staff" || role === "staff_member";

export const isFinanceAuditor = (role?: string | null) =>
  role === "viewer" || role === "board";

export const hasFinancePermission = (role: string | null | undefined, permission: FinancePermission): boolean => {
  if (!canReadFinanceLedger(role) && permission !== "audit_read") return false;
  if (permission === "audit_read") return canReadFinanceLedger(role) || isFinanceAuditor(role);
  switch (permission) {
    case "read_ledger":
      return canReadFinanceLedger(role);
    case "save_draft":
      return isFinanceStaff(role);
    case "manage_ledger":
    case "post_journal":
    case "approve_bill":
    case "void_transaction":
    case "reconcile_bank":
    case "edit_settings":
      return isFinanceManager(role);
    default:
      return false;
  }
};
