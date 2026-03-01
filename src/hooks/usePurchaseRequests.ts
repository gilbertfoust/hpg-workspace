import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function usePurchaseRequests(filters?: { status?: string; ngo_id?: string }) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["purchase_requests", filters],
    queryFn: async () => {
      let q = supabase.from("purchase_requests")
        .select("*, ngos(legal_name, common_name), profiles(full_name), org_units(department_name)")
        .order("created_at", { ascending: false });
      if (filters?.status) q = q.eq("status", filters.status);
      if (filters?.ngo_id) q = q.eq("ngo_id", filters.ngo_id);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async (pr: { title: string; ngo_id: string; description?: string; estimated_amount?: number; priority?: string; needed_by?: string; requested_by_user_id?: string; department_id?: string; notes?: string }) => {
      const { data, error } = await supabase.from("purchase_requests").insert(pr).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["purchase_requests"] }); toast.success("Purchase request created"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status, approved_by_user_id, rejected_reason }: { id: string; status: string; approved_by_user_id?: string; rejected_reason?: string }) => {
      const updates: Record<string, unknown> = { status };
      if (status === "approved" && approved_by_user_id) { updates.approved_by_user_id = approved_by_user_id; updates.approved_at = new Date().toISOString(); }
      if (status === "rejected" && rejected_reason) updates.rejected_reason = rejected_reason;
      const { error } = await supabase.from("purchase_requests").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["purchase_requests"] }); toast.success("Status updated"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return { ...query, create, updateStatus };
}
