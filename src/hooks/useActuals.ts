import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Actual {
  id: string;
  ngo_id: string;
  fiscal_period_id: string;
  category_id: string;
  amount: number;
  source: string;
  supporting_document_url: string | null;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export function useActuals(ngoId?: string, fiscalPeriodId?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["actuals", ngoId, fiscalPeriodId],
    enabled: !!ngoId && !!fiscalPeriodId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("actuals" as any)
        .select("*")
        .eq("ngo_id", ngoId!)
        .eq("fiscal_period_id", fiscalPeriodId!);
      if (error) throw error;
      return (data || []) as unknown as Actual[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (actual: Omit<Actual, "created_at" | "updated_at"> & { id?: string }) => {
      if (actual.id) {
        const { id, ...updates } = actual;
        const { data, error } = await supabase.from("actuals" as any).update(updates as any).eq("id", id).select().single();
        if (error) throw error;
        return data as unknown as Actual;
      } else {
        const { data, error } = await supabase.from("actuals" as any).insert(actual as any).select().single();
        if (error) throw error;
        return data as unknown as Actual;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["actuals"] }),
  });

  return { ...query, upsert };
}
