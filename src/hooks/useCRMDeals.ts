import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useCRMDeals(filters?: { stage?: string; deal_type?: string }) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["crm_deals", filters],
    queryFn: async () => {
      let q = supabase.from("crm_deals")
        .select("*, crm_organizations(name), crm_contacts(first_name, last_name), profiles(full_name)")
        .order("created_at", { ascending: false });
      if (filters?.stage) q = q.eq("stage", filters.stage);
      if (filters?.deal_type) q = q.eq("deal_type", filters.deal_type);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async (deal: { title: string; deal_type: string; organization_id?: string; contact_id?: string; amount?: number; probability?: number; expected_close_date?: string; ngo_id?: string; notes?: string }) => {
      const { data, error } = await supabase.from("crm_deals").insert(deal).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["crm_deals"] }); toast.success("Deal created"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateStage = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: string }) => {
      const updates: Record<string, unknown> = { stage };
      if (stage === "won" || stage === "lost" || stage === "closed") updates.actual_close_date = new Date().toISOString().split("T")[0];
      const { error } = await supabase.from("crm_deals").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["crm_deals"] }); toast.success("Deal updated"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return { ...query, create, updateStage };
}
