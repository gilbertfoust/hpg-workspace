import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useInventoryItems(filters?: { ngo_id?: string; category?: string; is_active?: boolean }) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["inventory_items", filters],
    queryFn: async () => {
      let q = supabase!.from("inventory_items")
        .select("*, ngos(legal_name, common_name)")
        .order("name");
      if (filters?.ngo_id) q = q.eq("ngo_id", filters.ngo_id);
      if (filters?.category) q = q.eq("category", filters.category);
      if (filters?.is_active !== undefined) q = q.eq("is_active", filters.is_active);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    enabled: !!supabase,
  });

  const create = useMutation({
    mutationFn: async (item: { name: string; ngo_id: string; category?: string; sku?: string; description?: string; unit_of_measure?: string; quantity_on_hand?: number; reorder_point?: number; reorder_quantity?: number; unit_cost?: number; location?: string; notes?: string }) => {
      const { data, error } = await supabase!.from("inventory_items").insert(item).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["inventory_items"] }); toast.success("Item added"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Record<string, unknown>) => {
      const { error } = await supabase!.from("inventory_items").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["inventory_items"] }); toast.success("Item updated"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return { ...query, create, update };
}
