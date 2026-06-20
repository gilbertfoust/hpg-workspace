import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSupabaseNotConfiguredError, supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const AVATAR_BUCKET = "profile-avatars";

export interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  department_id: string | null;
  role?: string | null;
  created_at: string;
  updated_at: string;
}

const ensureSupabase = () => {
  if (!supabase) {
    throw getSupabaseNotConfiguredError();
  }
};

export const useProfiles = () => {
  return useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      ensureSupabase();

      const { data, error } = await supabase!
        .from("profiles")
        .select("*")
        .order("full_name", { ascending: true });

      if (error) throw error;
      return data as Profile[];
    },
  });
};

export const useProfile = (id: string) => {
  return useQuery({
    queryKey: ["profiles", id],
    queryFn: async () => {
      ensureSupabase();

      const { data, error } = await supabase!
        .from("profiles")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      return data as Profile;
    },
    enabled: !!id,
  });
};

export const useCurrentProfile = () => {
  return useQuery({
    queryKey: ["current-profile"],
    enabled: !!supabase,
    queryFn: async () => {
      ensureSupabase();
      const {
        data: { user },
      } = await supabase!.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase!
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (error) throw error;
      return (data as Profile) ?? null;
    },
  });
};

export const useUpdateProfileAvatar = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ userId, file }: { userId: string; file: File }) => {
      ensureSupabase();

      const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const filePath = `${userId}/avatar.${extension}`;

      const { error: uploadError } = await supabase!.storage
        .from(AVATAR_BUCKET)
        .upload(filePath, file, {
          upsert: true,
          cacheControl: "3600",
          contentType: file.type || "image/jpeg",
        });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase!.storage.from(AVATAR_BUCKET).getPublicUrl(filePath);
      const avatarUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`;

      const { data, error } = await supabase!
        .from("profiles")
        .update({ avatar_url: avatarUrl } as never)
        .eq("id" as never, userId as never)
        .select()
        .single();

      if (error) throw error;
      return data as Profile;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      queryClient.invalidateQueries({ queryKey: ["current-profile"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      toast({ title: "Profile photo updated" });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Could not upload photo",
        description:
          error.message.includes("Bucket not found") || error.message.includes("not found")
            ? "Profile avatar storage is not configured on the server yet."
            : error.message,
      });
    },
  });
};

export const useInternalUsers = () => {
  return useQuery({
    queryKey: ["internal-users"],
    queryFn: async () => {
      ensureSupabase();

      // 1) Get user roles that are *not* external_ngo
      const { data: userRoles, error: rolesError } = await supabase!
        .from("user_roles")
        .select("user_id, role")
        .not("role", "eq", "external_ngo");

      if (rolesError) throw rolesError;
      if (!userRoles || userRoles.length === 0) {
        return [] as Profile[];
      }

      const userIds = [...new Set(userRoles.map((ur) => ur.user_id))];

      // 2) Fetch matching profiles, excluding external_portal
      const { data: profileRows, error: profilesError } = await supabase!
        .from("profiles")
        .select("*")
        .in("id", userIds);

      if (profilesError) throw profilesError;

      return (profileRows || []) as Profile[];
    },
  });
};
