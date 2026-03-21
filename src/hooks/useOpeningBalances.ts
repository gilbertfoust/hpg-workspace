import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface OpeningBalance {
  id: string;
  ngo_id: string;
  fiscal_period_id: string;
  account_id: string;
  amount: number;
  created_at: string;
}

export function useOpeningBalances(ngoId?: string, fiscalPeriodId?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["opening_balances", ngoId, fiscalPeriodId],
    enabled: !!ngoId && !!fiscalPeriodId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("opening_balances")
        .select("*")
        .eq("ngo_id", ngoId!)
        .eq("fiscal_period_id", fiscalPeriodId!);
      if (error) throw error;
      return (data || []) as OpeningBalance[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (input: Omit<OpeningBalance, "id" | "created_at">) => {
      const { data, error } = await (supabase as any)
        .from("opening_balances")
        .upsert(input, { onConflict: "ngo_id,fiscal_period_id,account_id" })
        .select()
        .single();
      if (error) throw error;
      return data as OpeningBalance;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["opening_balances"] });
      queryClient.invalidateQueries({ queryKey: ["trial_balance"] });
    },
  });

  return { ...query, upsert };
}
