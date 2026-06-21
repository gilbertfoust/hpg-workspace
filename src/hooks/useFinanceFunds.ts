import { useQuery } from "@tanstack/react-query";
import { getSupabaseNotConfiguredError, supabase } from "@/integrations/supabase/client";
import type { FinanceFund } from "@/types/financeAccounting";

const ensureSupabase = () => {
  if (!supabase) throw getSupabaseNotConfiguredError();
};

export const useFinanceFunds = (options?: { includeInactive?: boolean }) => {
  return useQuery({
    queryKey: ["finance-funds", options?.includeInactive ?? false],
    enabled: !!supabase,
    queryFn: async () => {
      ensureSupabase();
      let query = supabase.from("finance_funds" as never).select("*").order("name", { ascending: true });
      if (!options?.includeInactive) {
        query = query.eq("is_active" as never, true as never);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as FinanceFund[];
    },
  });
};
