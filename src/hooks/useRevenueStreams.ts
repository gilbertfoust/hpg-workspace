import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useRevenueStreams(filters?: { ngo_id?: string; stream_type?: string }) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["revenue_streams", filters],
    queryFn: async () => {
      let q = supabase!.from("revenue_streams")
        .select("*, ngos(legal_name, common_name)")
        .order("name");
      if (filters?.ngo_id) q = q.eq("ngo_id", filters.ngo_id);
      if (filters?.stream_type) q = q.eq("stream_type", filters.stream_type);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    enabled: !!supabase,
  });

  const create = useMutation({
    mutationFn: async (stream: { name: string; ngo_id: string; stream_type?: string; source?: string; description?: string; annual_target?: number; account_id?: string; notes?: string }) => {
      const { data, error } = await supabase!.from("revenue_streams").insert(stream).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["revenue_streams"] }); toast.success("Revenue stream added"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Record<string, unknown>) => {
      const { error } = await supabase!.from("revenue_streams").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["revenue_streams"] }); toast.success("Stream updated"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return { ...query, create, update };
}
