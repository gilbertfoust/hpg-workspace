import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, getSupabaseNotConfiguredError } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import type { Profile } from "./useProfiles";

const ensureSupabase = () => {
  if (!supabase) {
    throw getSupabaseNotConfiguredError();
  }
};

export const useAdminUsers = () => {
  return useQuery({
    queryKey: ["admin", "users"],
    queryFn: async () => {
      ensureSupabase();

      // Get all profiles with their roles
      const { data: profiles, error: profilesError } = await supabase!
        .from("profiles")
        .select("*")
        .order("full_name", { ascending: true });

      if (profilesError) throw profilesError;

      // Get all user roles
      const { data: userRoles, error: rolesError } = await supabase!
        .from("user_roles")
        .select("user_id, role");

      if (rolesError) throw rolesError;

      // Combine profiles with roles
      const usersWithRoles = (profiles || []).map((profile) => {
        const roles = (userRoles || [])
          .filter((ur) => ur.user_id === profile.id)
          .map((ur) => ur.role);
        
        return {
          ...profile,
          roles: roles.length > 0 ? roles : ["staff"], // Default role if none assigned
        };
      });

      return usersWithRoles as (Profile & { roles: string[] })[];
    },
    enabled: !!supabase, // Only run if Supabase is configured
    retry: false, // Don't retry on error
  });
};

export const useDeleteAdminUser = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { deleteUser } = useAuth();

  return useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await deleteUser(userId);
      if (error) throw error;
      return userId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      queryClient.invalidateQueries({ queryKey: ["internal-users"] });
      toast({
        title: "User deleted",
        description: "The user has been successfully deleted.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error deleting user",
        description: error.message || "Unable to delete user. Please try again.",
      });
    },
  });
};
