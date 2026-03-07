import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function usePurchaseOrders(filters?: { status?: string; ngo_id?: string }) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["purchase_orders", filters],
    queryFn: async () => {
      let q = supabase.from("purchase_orders")
        .select("*, ngos(legal_name, common_name), crm_organizations(name)")
        .order("created_at", { ascending: false });
      if (filters?.status) q = q.eq("status", filters.status);
      if (filters?.ngo_id) q = q.eq("ngo_id", filters.ngo_id);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async (po: { ngo_id: string; po_number: string; vendor_org_id?: string; purchase_request_id?: string; order_date?: string; expected_delivery?: string; subtotal?: number; tax_amount?: number; total_amount?: number; created_by_user_id?: string; notes?: string }) => {
      const { data, error } = await supabase.from("purchase_orders").insert(po).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["purchase_orders"] }); toast.success("Purchase order created"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status, approved_by_user_id }: { id: string; status: string; approved_by_user_id?: string }) => {
      const updates: Record<string, unknown> = { status };
      if (status === "approved" && approved_by_user_id) { updates.approved_by_user_id = approved_by_user_id; updates.approved_at = new Date().toISOString(); }
      const { error } = await supabase.from("purchase_orders").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["purchase_orders"] }); toast.success("PO status updated"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return { ...query, create, updateStatus };
}
