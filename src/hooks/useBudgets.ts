import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Budget {
  id: string;
  ngo_id: string;
  fiscal_period_id: string;
  category_id: string;
  amount: number;
  notes: string | null;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export function useBudgets(ngoId?: string, fiscalPeriodId?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["budgets", ngoId, fiscalPeriodId],
    enabled: !!ngoId && !!fiscalPeriodId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("budgets" as any)
        .select("*")
        .eq("ngo_id", ngoId!)
        .eq("fiscal_period_id", fiscalPeriodId!);
      if (error) throw error;
      return (data || []) as unknown as Budget[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (budget: Omit<Budget, "created_at" | "updated_at"> & { id?: string }) => {
      if (budget.id) {
        const { id, ...updates } = budget;
        const { data, error } = await supabase.from("budgets" as any).update(updates as any).eq("id", id).select().single();
        if (error) throw error;
        return data as unknown as Budget;
      } else {
        const { data, error } = await supabase.from("budgets" as any).insert(budget as any).select().single();
        if (error) throw error;
        return data as unknown as Budget;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["budgets"] }),
  });

  return { ...query, upsert };
}
