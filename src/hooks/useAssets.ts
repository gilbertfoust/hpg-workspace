import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useAssets(filters?: { status?: string; ngo_id?: string; category?: string }) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["assets", filters],
    queryFn: async () => {
      let q = supabase.from("assets")
        .select("*, ngos(legal_name, common_name), staff_profiles(first_name, last_name)")
        .order("name");
      if (filters?.status) q = q.eq("status", filters.status);
      if (filters?.ngo_id) q = q.eq("ngo_id", filters.ngo_id);
      if (filters?.category) q = q.eq("category", filters.category);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async (asset: { name: string; ngo_id: string; category?: string; acquisition_date?: string; acquisition_cost?: number; salvage_value?: number; useful_life_months?: number; depreciation_method?: string; location?: string; asset_tag?: string; serial_number?: string; notes?: string }) => {
      const { data, error } = await supabase.from("assets").insert(asset).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["assets"] }); toast.success("Asset added"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Record<string, unknown>) => {
      const { error } = await supabase.from("assets").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["assets"] }); toast.success("Asset updated"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return { ...query, create, update };
}
