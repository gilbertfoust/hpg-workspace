import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useAssetDepreciation(filters?: { asset_id?: string; ngo_id?: string }) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["asset_depreciation", filters],
    queryFn: async () => {
      let q = supabase.from("asset_depreciation")
        .select("*, assets(name)")
        .order("period_date", { ascending: false });
      if (filters?.asset_id) q = q.eq("asset_id", filters.asset_id);
      if (filters?.ngo_id) q = q.eq("ngo_id", filters.ngo_id);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async (rec: { asset_id: string; ngo_id: string; period_label: string; period_date: string; depreciation_amount: number; accumulated_depreciation: number; book_value: number }) => {
      const { data, error } = await supabase.from("asset_depreciation").insert(rec).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["asset_depreciation"] }); toast.success("Depreciation recorded"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return { ...query, create };
}
