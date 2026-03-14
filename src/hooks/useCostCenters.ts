import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface CostCenter {
  id: string;
  ngo_id: string | null;
  code: string;
  name: string;
  type: string;
  parent_cost_center_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function useCostCenters(filters?: { ngo_id?: string; type?: string }) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["cost_centers", filters],
    queryFn: async () => {
      let q = (supabase as any).from("cost_centers").select("*").eq("is_active", true).order("code");
      if (filters?.ngo_id) q = q.eq("ngo_id", filters.ngo_id);
      if (filters?.type) q = q.eq("type", filters.type);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as CostCenter[];
    },
  });

  const create = useMutation({
    mutationFn: async (cc: Omit<CostCenter, "id" | "created_at" | "updated_at">) => {
      const { data, error } = await (supabase as any).from("cost_centers").insert(cc).select().single();
      if (error) throw error;
      return data as CostCenter;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["cost_centers"] }); toast.success("Cost center created"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CostCenter> & { id: string }) => {
      const { data, error } = await (supabase as any).from("cost_centers").update(updates).eq("id", id).select().single();
      if (error) throw error;
      return data as CostCenter;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["cost_centers"] }); toast.success("Cost center updated"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return { ...query, create, update };
}
