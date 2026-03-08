import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface UsageEntry {
  id: string;
  ngo_id: string | null;
  fiscal_period_id: string;
  cost_center_id: string;
  usage_source_id: string;
  quantity: number;
  unit_type: string;
  unit_cost: number;
  total_cost: number;
  usage_date: string;
  description: string;
  source_reference_type: string | null;
  source_reference_id: string | null;
  submitted_by_user_id: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export function useUsageEntries(filters?: { fiscal_period_id?: string; cost_center_id?: string; status?: string; ngo_id?: string }) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["usage_entries", filters],
    queryFn: async () => {
      let q = (supabase as any).from("usage_entries").select("*, cost_centers(code, name), usage_sources(name, type)").order("usage_date", { ascending: false });
      if (filters?.fiscal_period_id) q = q.eq("fiscal_period_id", filters.fiscal_period_id);
      if (filters?.cost_center_id) q = q.eq("cost_center_id", filters.cost_center_id);
      if (filters?.status) q = q.eq("status", filters.status);
      if (filters?.ngo_id) q = q.eq("ngo_id", filters.ngo_id);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as (UsageEntry & { cost_centers: { code: string; name: string } | null; usage_sources: { name: string; type: string } | null })[];
    },
  });

  const create = useMutation({
    mutationFn: async (entry: Omit<UsageEntry, "id" | "created_at" | "updated_at">) => {
      const { data, error } = await (supabase as any).from("usage_entries").insert(entry).select().single();
      if (error) throw error;
      return data as UsageEntry;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["usage_entries"] }); toast.success("Usage entry created"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { data, error } = await (supabase as any).from("usage_entries").update({ status }).eq("id", id).select().single();
      if (error) throw error;
      return data as UsageEntry;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["usage_entries"] }); toast.success("Status updated"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return { ...query, create, updateStatus };
}
