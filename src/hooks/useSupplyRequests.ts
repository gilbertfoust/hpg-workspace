import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useSupplyRequests(filters?: { ngo_id?: string; status?: string }) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["supply_requests", filters],
    queryFn: async () => {
      let q = supabase!.from("supply_requests")
        .select("*, profiles(full_name), supply_request_items(*, inventory_items(name))")
        .order("created_at", { ascending: false });
      if (filters?.ngo_id) q = q.eq("ngo_id", filters.ngo_id);
      if (filters?.status) q = q.eq("status", filters.status);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    enabled: !!supabase,
  });

  const create = useMutation({
    mutationFn: async (req: { ngo_id: string; request_number: string; requested_by_user_id?: string; priority?: string; needed_by?: string; notes?: string }) => {
      const { data, error } = await supabase!.from("supply_requests").insert(req).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["supply_requests"] }); toast.success("Request created"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Record<string, unknown>) => {
      const { error } = await supabase!.from("supply_requests").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["supply_requests"] }); toast.success("Request updated"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return { ...query, create, update };
}
