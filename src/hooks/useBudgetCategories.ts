import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface BudgetCategory {
  id: string;
  ngo_id: string | null;
  code: string;
  name: string;
  type: string;
  is_active: boolean;
  created_at: string;
}

export function useBudgetCategories(ngoId?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["budget_categories", ngoId],
    queryFn: async () => {
      // Fetch global (ngo_id IS NULL) + NGO-specific categories
      let q = supabase.from("budget_categories" as any).select("*").eq("is_active", true).order("code");
      if (ngoId) {
        q = q.or(`ngo_id.is.null,ngo_id.eq.${ngoId}`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as BudgetCategory[];
    },
  });

  const create = useMutation({
    mutationFn: async (cat: Omit<BudgetCategory, "id" | "created_at">) => {
      const { data, error } = await supabase.from("budget_categories" as any).insert(cat as any).select().single();
      if (error) throw error;
      return data as unknown as BudgetCategory;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["budget_categories"] }),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<BudgetCategory> & { id: string }) => {
      const { data, error } = await supabase.from("budget_categories" as any).update(updates as any).eq("id", id).select().single();
      if (error) throw error;
      return data as unknown as BudgetCategory;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["budget_categories"] }),
  });

  return { ...query, create, update };
}
