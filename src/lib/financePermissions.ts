import type { AppRole } from "@/hooks/useUserRole";
import { isAdminRole } from "@/hooks/useUserRole";

/** Finance ledger permission tiers aligned with Supabase RLS helpers. */
export type FinancePermission =
  | "read_ledger"
  | "manage_ledger"
  | "post_journal"
  | "approve_bill"
  | "void_transaction"
  | "reconcile_bank"
  | "edit_settings";

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

export const hasFinancePermission = (role: string | null | undefined, permission: FinancePermission): boolean => {
  if (!canReadFinanceLedger(role)) return false;
  switch (permission) {
    case "read_ledger":
      return true;
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
