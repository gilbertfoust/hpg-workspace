import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type AppRole = string;

export interface UserRole {
  user_id: string;
  role: AppRole;
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

export const STAFF_WORKSPACE_ROLES: AppRole[] = [
  "staff",
  "super_admin",
  "admin_pm",
  "ngo_coordinator",
  "department_lead",
  "executive_secretariat",
];

export const isNgoPortalRole = (role?: string | null) => !!role && NGO_PORTAL_ROLES.includes(role);
export const isStaffWorkspaceRole = (role?: string | null) => !!role && STAFF_WORKSPACE_ROLES.includes(role);

export const useUserRole = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["user-role", user?.id],
    enabled: !!user?.id && !!supabase,
    queryFn: async () => {
      ensureSupabase();
      if (!user?.id) return null;

      const { data: profileRole, error: profileError } = await supabase
        .from("profiles")
        .select("id, role")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) throw profileError;
      if (profileRole?.role) {
        return { user_id: user.id, role: profileRole.role } as UserRole;
      }

      const { data, error } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as UserRole | null;
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
    mutationFn: async ({
      userId,
      role,
    }: {
      userId: string;
      role: AppRole;
    }) => {
      ensureSupabase();

      const { data, error } = await supabase
        .from("user_roles")
        .upsert(
          { user_id: userId, role } as any,
          {
            onConflict: "user_id,role",
          }
        )
        .select()
        .maybeSingle();

      if (error) throw error;

      await supabase
        .from("profiles")
        .update({ role } as never)
        .eq("id" as never, userId as never);

      return data as UserRole | null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-roles"] });
      queryClient.invalidateQueries({ queryKey: ["user-role"] });
    },
  });
};

export const useIsAdminUser = () => {
  const { data: userRole } = useUserRole();
  const adminRoles: AppRole[] = ["super_admin"];
  return !!userRole && adminRoles.includes(userRole.role);
};
