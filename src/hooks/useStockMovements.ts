import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useStockMovements(filters?: { ngo_id?: string; item_id?: string; movement_type?: string }) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["stock_movements", filters],
    queryFn: async () => {
      let q = supabase!.from("stock_movements")
        .select("*, inventory_items(name), profiles(full_name)")
        .order("created_at", { ascending: false });
      if (filters?.ngo_id) q = q.eq("ngo_id", filters.ngo_id);
      if (filters?.item_id) q = q.eq("item_id", filters.item_id);
      if (filters?.movement_type) q = q.eq("movement_type", filters.movement_type);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    enabled: !!supabase,
  });

  const create = useMutation({
    mutationFn: async (movement: { ngo_id: string; item_id: string; movement_type: string; quantity: number; reference_number?: string; performed_by_user_id?: string; notes?: string }) => {
      const { data, error } = await supabase!.from("stock_movements").insert(movement).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stock_movements"] });
      qc.invalidateQueries({ queryKey: ["inventory_items"] });
      toast.success("Movement recorded");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { ...query, create };
}
