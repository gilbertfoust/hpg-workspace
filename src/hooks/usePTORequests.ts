import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function usePTORequests(filters?: { status?: string; staff_id?: string; ngo_id?: string }) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["pto_requests", filters],
    queryFn: async () => {
      let q = supabase.from("pto_requests")
        .select("*, staff_profiles(first_name, last_name), ngos(legal_name, common_name)")
        .order("start_date", { ascending: false });
      if (filters?.status) q = q.eq("status", filters.status);
      if (filters?.staff_id) q = q.eq("staff_id", filters.staff_id);
      if (filters?.ngo_id) q = q.eq("ngo_id", filters.ngo_id);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async (pto: { staff_id: string; ngo_id: string; leave_type: string; start_date: string; end_date: string; hours_requested?: number; reason?: string }) => {
      const { data, error } = await supabase.from("pto_requests").insert(pto).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["pto_requests"] }); toast.success("PTO request submitted"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status, approved_by_user_id }: { id: string; status: string; approved_by_user_id?: string }) => {
      const updates: Record<string, unknown> = { status };
      if (status === "approved" && approved_by_user_id) { updates.approved_by_user_id = approved_by_user_id; updates.approved_at = new Date().toISOString(); }
      const { error } = await supabase.from("pto_requests").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["pto_requests"] }); toast.success("PTO status updated"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return { ...query, create, updateStatus };
}
