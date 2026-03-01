import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Reconciliation {
  id: string;
  ngo_id: string;
  fiscal_period_id: string;
  status: "open" | "in_progress" | "closed";
  reconciled_by_user_id: string | null;
  reconciled_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function useReconciliation(ngoId?: string, fiscalPeriodId?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["reconciliation", ngoId, fiscalPeriodId],
    enabled: !!ngoId && !!fiscalPeriodId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("reconciliations")
        .select("*")
        .eq("ngo_id", ngoId!)
        .eq("fiscal_period_id", fiscalPeriodId!)
        .maybeSingle();
      if (error) throw error;
      return data as Reconciliation | null;
    },
  });

  const upsert = useMutation({
    mutationFn: async (payload: Partial<Reconciliation> & { ngo_id: string; fiscal_period_id: string }) => {
      const { data: existing } = await (supabase as any)
        .from("reconciliations")
        .select("id")
        .eq("ngo_id", payload.ngo_id)
        .eq("fiscal_period_id", payload.fiscal_period_id)
        .maybeSingle();

      if (existing) {
        const { data, error } = await (supabase as any)
          .from("reconciliations")
          .update({ status: payload.status, notes: payload.notes, reconciled_by_user_id: payload.reconciled_by_user_id, reconciled_at: payload.status === "closed" ? new Date().toISOString() : null })
          .eq("id", existing.id)
          .select()
          .single();
        if (error) throw error;
        return data as Reconciliation;
      } else {
        const { data, error } = await (supabase as any)
          .from("reconciliations")
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        return data as Reconciliation;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["reconciliation"] }),
  });

  return { ...query, upsert };
}
