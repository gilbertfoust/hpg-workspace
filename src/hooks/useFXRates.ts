import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const db = () => supabase as any;

export function useFXRates() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["fx_rates"],
    queryFn: async () => {
      const { data, error } = await db().from("fx_rates").select("*").order("effective_date", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const create = useMutation({
    mutationFn: async (rate: { from_currency: string; to_currency: string; rate: number; effective_date?: string; source?: string }) => {
      const { data, error } = await db().from("fx_rates").insert(rate).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["fx_rates"] }); toast.success("FX rate added"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db().from("fx_rates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["fx_rates"] }); toast.success("Rate removed"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return { ...query, create, remove };
}
