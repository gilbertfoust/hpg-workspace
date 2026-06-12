import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSupabaseNotConfiguredError, supabase } from "@/integrations/supabase/client";
import type { ModuleType } from "@/hooks/useWorkItems";

export interface Department {
  id: string;
  name: string;
  module: ModuleType;
  google_drive_folder_url: string | null;
  google_drive_folder_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const ensureSupabase = () => {
  if (!supabase) throw getSupabaseNotConfiguredError();
  return supabase;
};

export const useDepartments = () => {
  return useQuery<Department[]>({
    queryKey: ["departments"],
    enabled: !!supabase,
    queryFn: async () => {
      const client = ensureSupabase();
      const { data, error } = await client
        .from("departments" as never)
        .select("*" as never)
        .eq("is_active" as never, true as never)
        .order("name" as never, { ascending: true });

      if (error) throw error;
      return (data || []) as unknown as Department[];
    },
  });
};

export const useUpdateDepartmentDriveFolder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      google_drive_folder_url,
      google_drive_folder_id,
    }: {
      id: string;
      google_drive_folder_url?: string | null;
      google_drive_folder_id?: string | null;
    }) => {
      const client = ensureSupabase();
      const { data, error } = await client
        .from("departments" as never)
        .update({ google_drive_folder_url: google_drive_folder_url || null, google_drive_folder_id: google_drive_folder_id || null } as never)
        .eq("id" as never, id as never)
        .select("*" as never)
        .single();

      if (error) throw error;
      return data as unknown as Department;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments"] });
    },
  });
};
