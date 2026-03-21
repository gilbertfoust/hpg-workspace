import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface BankReconciliation {
  id: string;
  ngo_id: string;
  fiscal_period_id: string;
  bank_account_id: string;
  starting_balance: number;
  adjusted_balance: number;
  status: "draft" | "in_review" | "reconciled";
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface BankReconciliationItem {
  id: string;
  reconciliation_id: string;
  item_type: "deposit_in_transit" | "outstanding_check" | "deposit_not_recorded" | "transfer_not_recorded" | "adjustment";
  item_date: string;
  description: string;
  amount: number;
  linked_transaction_id: string | null;
  created_at: string;
}

export function useBankReconciliations(ngoId?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["bank_reconciliations", ngoId],
    enabled: !!ngoId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("bank_reconciliations")
        .select("*")
        .eq("ngo_id", ngoId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as BankReconciliation[];
    },
  });

  const create = useMutation({
    mutationFn: async (input: Omit<BankReconciliation, "id" | "created_at" | "updated_at">) => {
      const { data, error } = await (supabase as any)
        .from("bank_reconciliations")
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data as BankReconciliation;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["bank_reconciliations"] }),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<BankReconciliation> & { id: string }) => {
      const { data, error } = await (supabase as any)
        .from("bank_reconciliations")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as BankReconciliation;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["bank_reconciliations"] }),
  });

  return { ...query, create, update };
}

export function useBankReconciliationItems(reconciliationId?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["bank_reconciliation_items", reconciliationId],
    enabled: !!reconciliationId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("bank_reconciliation_items")
        .select("*")
        .eq("reconciliation_id", reconciliationId!)
        .order("item_date");
      if (error) throw error;
      return (data || []) as BankReconciliationItem[];
    },
  });

  const create = useMutation({
    mutationFn: async (input: Omit<BankReconciliationItem, "id" | "created_at">) => {
      const { data, error } = await (supabase as any)
        .from("bank_reconciliation_items")
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data as BankReconciliationItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank_reconciliation_items"] });
      queryClient.invalidateQueries({ queryKey: ["bank_reconciliations"] });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("bank_reconciliation_items")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank_reconciliation_items"] });
      queryClient.invalidateQueries({ queryKey: ["bank_reconciliations"] });
    },
  });

  return { ...query, create, remove };
}
