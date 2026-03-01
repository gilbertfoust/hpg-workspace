import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useStaffProfiles(filters?: { status?: string; ngo_id?: string; department_id?: string }) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["staff_profiles", filters],
    queryFn: async () => {
      let q = supabase.from("staff_profiles")
        .select("*, ngos(legal_name, common_name), org_units(department_name)")
        .order("last_name");
      if (filters?.status) q = q.eq("status", filters.status);
      if (filters?.ngo_id) q = q.eq("ngo_id", filters.ngo_id);
      if (filters?.department_id) q = q.eq("department_id", filters.department_id);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async (staff: { first_name: string; last_name: string; ngo_id: string; email?: string; phone?: string; department_id?: string; job_title?: string; employment_type?: string; start_date?: string; hourly_rate?: number; annual_salary?: number; notes?: string }) => {
      const { data, error } = await supabase.from("staff_profiles").insert(staff).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["staff_profiles"] }); toast.success("Staff member added"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Record<string, unknown>) => {
      const { error } = await supabase.from("staff_profiles").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["staff_profiles"] }); toast.success("Staff updated"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return { ...query, create, update };
}
