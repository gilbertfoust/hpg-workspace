import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type AppRole = string;

export interface UserRole {
  user_id: string;
  role: AppRole;
  department_id?: string | null;
  department_name?: string | null;
  sub_department_name?: string | null;
  org_rank?: string | null;
  supervisor_user_id?: string | null;
}

const getSupabaseNotConfiguredError = () =>
  new Error(
    "Supabase not configured: missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY"
  );

const ensureSupabase = () => {
  if (!supabase) {
    throw getSupabaseNotConfiguredError();
  }
};

export const NGO_PORTAL_ROLES: AppRole[] = ["ngo_user", "external_ngo"];

export const ADMIN_ROLES: AppRole[] = ["super_admin", "admin_pm"];

export const VP_ROLES: AppRole[] = [
  "vp_operations",
  "vp_programs",
  "vp_development",
  "vp_finance",
  "vp_communications",
];

export const DEPARTMENT_LEAD_ROLES: AppRole[] = [
  "ngo_coordinator",
  "department_lead",
  "executive_secretariat",
];

export const STAFF_WORKSPACE_ROLES: AppRole[] = [
  ...ADMIN_ROLES,
  ...VP_ROLES,
  ...DEPARTMENT_LEAD_ROLES,
  "staff",
  "staff_member",
];

export const isNgoPortalRole = (role?: string | null) => !!role && NGO_PORTAL_ROLES.includes(role);
export const isAdminRole = (role?: string | null) => !!role && ADMIN_ROLES.includes(role);
export const isVpRole = (role?: string | null) => !!role && VP_ROLES.includes(role);
export const isDepartmentLeadRole = (role?: string | null) => !!role && DEPARTMENT_LEAD_ROLES.includes(role);
export const isStaffWorkspaceRole = (role?: string | null) => !!role && STAFF_WORKSPACE_ROLES.includes(role);

export const getRoleAccessLane = (role?: string | null) => {
  if (!role) return "Unassigned";
  if (isNgoPortalRole(role)) return "NGO Portal Only";
  if (isAdminRole(role)) return "Admin / Executive";
  if (isVpRole(role)) return "VP / Executive Department";
  if (isDepartmentLeadRole(role)) return "Department Leadership";
  if (isStaffWorkspaceRole(role)) return "Staff Workspace";
  return "Custom";
};

export const useUserRole = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["user-role", user?.id],
    enabled: !!user?.id && !!supabase,
    queryFn: async () => {
      ensureSupabase();
      if (!user?.id) return null;

      const { data: profileRole, error: profileError } = await (supabase as any)
        .from("profiles")
        .select("id, role, department_id, org_rank, supervisor_user_id, org_units(department_name, sub_department_name)")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) throw profileError;
      if (profileRole?.role) {
        const unit = Array.isArray(profileRole.org_units) ? profileRole.org_units[0] : profileRole.org_units;
        return {
          user_id: user.id,
          role: profileRole.role,
          department_id: profileRole.department_id,
          department_name: unit?.department_name ?? null,
          sub_department_name: unit?.sub_department_name ?? null,
          org_rank: profileRole.org_rank,
          supervisor_user_id: profileRole.supervisor_user_id,
        } as UserRole;
      }

      const { data, error } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;
      const unit = Array.isArray(profileRole?.org_units) ? profileRole.org_units[0] : profileRole?.org_units;
      return {
        ...(data as UserRole),
        department_id: profileRole?.department_id ?? null,
        department_name: unit?.department_name ?? null,
        sub_department_name: unit?.sub_department_name ?? null,
        org_rank: profileRole?.org_rank ?? null,
        supervisor_user_id: profileRole?.supervisor_user_id ?? null,
      };
    },
  });
};

export const useUserRoles = () => {
  return useQuery({
    queryKey: ["user-roles"],
    enabled: !!supabase,
    queryFn: async () => {
      ensureSupabase();

      const { data, error } = await supabase
        .from("user_roles")
        .select("user_id, role");

      if (error) throw error;
      return (data || []) as UserRole[];
    },
  });
};

export const useUpdateUserRole = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      ensureSupabase();

      const { data, error } = await supabase.functions.invoke("admin-update-role", {
        body: {
          target_user_id: userId,
          new_role: role,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      return { user_id: userId, role } as UserRole;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-roles"] });
      queryClient.invalidateQueries({ queryKey: ["user-role"] });
    },
  });
};

export const useIsAdminUser = () => {
  const { data: userRole } = useUserRole();
  return !!userRole && isAdminRole(userRole.role);
};
