import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface FiscalPeriod {
  id: string;
  ngo_id: string;
  label: string;
  period_type: string;
  start_date: string;
  end_date: string;
  currency_code: string | null;
  created_at: string;
  updated_at: string;
}

export function useFiscalPeriods(ngoId?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["fiscal_periods", ngoId],
    queryFn: async () => {
      let q = supabase.from("fiscal_periods" as any).select("*").order("start_date", { ascending: false });
      if (ngoId) q = q.eq("ngo_id", ngoId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as FiscalPeriod[];
    },
  });

  const create = useMutation({
    mutationFn: async (period: Omit<FiscalPeriod, "id" | "created_at" | "updated_at">) => {
      const { data, error } = await supabase.from("fiscal_periods" as any).insert(period as any).select().single();
      if (error) throw error;
      return data as unknown as FiscalPeriod;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["fiscal_periods"] }),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<FiscalPeriod> & { id: string }) => {
      const { data, error } = await supabase.from("fiscal_periods" as any).update(updates as any).eq("id", id).select().single();
      if (error) throw error;
      return data as unknown as FiscalPeriod;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["fiscal_periods"] }),
  });

  return { ...query, create, update };
}
