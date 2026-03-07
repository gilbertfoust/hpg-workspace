import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Transaction {
  id: string;
  ngo_id: string;
  fiscal_period_id: string | null;
  transaction_date: string;
  description: string;
  reference_number: string | null;
  is_void: boolean;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface JournalEntryInput {
  account_id: string;
  debit: number;
  credit: number;
  memo?: string;
}

export function useTransactions(ngoId?: string, fiscalPeriodId?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["transactions", ngoId, fiscalPeriodId],
    enabled: !!ngoId,
    queryFn: async () => {
      let q = (supabase as any).from("transactions").select("*").eq("ngo_id", ngoId!).order("transaction_date", { ascending: false });
      if (fiscalPeriodId) q = q.eq("fiscal_period_id", fiscalPeriodId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as Transaction[];
    },
  });

  const create = useMutation({
    mutationFn: async (payload: {
      transaction: Omit<Transaction, "id" | "created_at" | "updated_at" | "is_void">;
      entries: JournalEntryInput[];
    }) => {
      // Insert transaction
      const { data: txn, error: txnErr } = await (supabase as any)
        .from("transactions")
        .insert(payload.transaction)
        .select()
        .single();
      if (txnErr) throw txnErr;

      // Insert journal entries
      const entries = payload.entries.map((e) => ({ ...e, transaction_id: txn.id }));
      const { error: jeErr } = await (supabase as any).from("journal_entries").insert(entries);
      if (jeErr) throw jeErr;

      return txn as Transaction;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["journal_entries"] });
      queryClient.invalidateQueries({ queryKey: ["trial_balance"] });
      queryClient.invalidateQueries({ queryKey: ["ledger"] });
    },
  });

  const voidTransaction = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("transactions").update({ is_void: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["trial_balance"] });
      queryClient.invalidateQueries({ queryKey: ["ledger"] });
    },
  });

  return { ...query, create, voidTransaction };
}
