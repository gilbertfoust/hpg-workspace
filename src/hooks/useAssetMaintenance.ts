import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useAssetMaintenance(filters?: { asset_id?: string; ngo_id?: string; status?: string }) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["asset_maintenance", filters],
    queryFn: async () => {
      let q = supabase.from("asset_maintenance")
        .select("*, assets(name)")
        .order("scheduled_date", { ascending: false });
      if (filters?.asset_id) q = q.eq("asset_id", filters.asset_id);
      if (filters?.ngo_id) q = q.eq("ngo_id", filters.ngo_id);
      if (filters?.status) q = q.eq("status", filters.status);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async (rec: { asset_id: string; ngo_id: string; description: string; maintenance_type?: string; scheduled_date?: string; cost?: number; notes?: string }) => {
      const { data, error } = await supabase.from("asset_maintenance").insert(rec).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["asset_maintenance"] }); toast.success("Maintenance record added"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status, completed_date }: { id: string; status: string; completed_date?: string }) => {
      const updates: Record<string, unknown> = { status };
      if (completed_date) updates.completed_date = completed_date;
      const { error } = await supabase.from("asset_maintenance").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["asset_maintenance"] }); toast.success("Maintenance updated"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return { ...query, create, updateStatus };
}
