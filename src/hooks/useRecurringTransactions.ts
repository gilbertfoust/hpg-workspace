import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useRecurringTransactions(ngoId?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["recurring_transactions", ngoId],
    enabled: !!ngoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recurring_transactions")
        .select("*")
        .eq("ngo_id", ngoId!)
        .order("next_run_date");
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async (rec: {
      ngo_id: string;
      template_name: string;
      frequency: string;
      next_run_date: string;
      end_date?: string;
      transaction_template: any;
    }) => {
      const { data, error } = await supabase.from("recurring_transactions").insert(rec).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["recurring_transactions"] }),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; [key: string]: any }) => {
      const { error } = await supabase.from("recurring_transactions").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["recurring_transactions"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("recurring_transactions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["recurring_transactions"] }),
  });

  return { ...query, create, update, remove };
}
