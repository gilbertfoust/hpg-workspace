import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useRevenueRecognition(filters?: { ngo_id?: string; recognition_type?: string }) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["revenue_recognition", filters],
    queryFn: async () => {
      let q = supabase!.from("revenue_recognition")
        .select("*, revenue_streams(name), fiscal_periods(label)")
        .order("recognition_date", { ascending: false });
      if (filters?.ngo_id) q = q.eq("ngo_id", filters.ngo_id);
      if (filters?.recognition_type) q = q.eq("recognition_type", filters.recognition_type);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    enabled: !!supabase,
  });

  const create = useMutation({
    mutationFn: async (entry: { ngo_id: string; recognition_date: string; amount: number; recognition_type?: string; revenue_stream_id?: string; fiscal_period_id?: string; deferred_amount?: number; description?: string; notes?: string }) => {
      const { data, error } = await supabase!.from("revenue_recognition").insert(entry).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["revenue_recognition"] }); toast.success("Recognition entry added"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Record<string, unknown>) => {
      const { error } = await supabase!.from("revenue_recognition").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["revenue_recognition"] }); toast.success("Entry updated"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return { ...query, create, update };
}
