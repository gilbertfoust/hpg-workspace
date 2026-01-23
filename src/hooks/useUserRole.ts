import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Basic role type. You can refine this union later if you want stricter typing.
 */
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

/**
 * Returns the current user's single role (or null if none).
 */
export const useUserRole = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["user-role", user?.id],
    enabled: !!user?.id && !!supabase,
    queryFn: async () => {
      ensureSupabase();
      if (!user?.id) return null;

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

/**
 * Returns all user_roles rows (for admin screens).
 */
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

/**
 * Mutation to upsert a role for a given user.
 * Note: onConflict uses the (user_id, role) unique constraint as per your migration.
 */
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
          { user_id: userId, role },
          {
            // matches unique constraint (user_id, role)
            // if you later enforce single-role-per-user, change the DB constraint
            onConflict: "user_id,role",
          }
        )
        .select()
        .maybeSingle();

      if (error) throw error;
      return data as UserRole | null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-roles"] });
      queryClient.invalidateQueries({ queryKey: ["user-role"] });
    },
  });
};

/**
 * Convenience hook: true iff the current user is an admin.
 * Right now we align it with the RLS comment from Codex and only treat super_admin as full admin.
 */
export const useIsAdminUser = () => {
  const { data: userRole } = useUserRole();

  const adminRoles: AppRole[] = ["super_admin"];
  return !!userRole && adminRoles.includes(userRole.role);
};
