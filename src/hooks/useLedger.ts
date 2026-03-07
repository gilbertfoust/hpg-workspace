import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface LedgerRow {
  id: string;
  transaction_id: string;
  transaction_date: string;
  description: string;
  reference_number: string | null;
  debit: number;
  credit: number;
  memo: string | null;
  is_void: boolean;
}

export function useLedger(ngoId?: string, accountId?: string, startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: ["ledger", ngoId, accountId, startDate, endDate],
    enabled: !!ngoId && !!accountId,
    queryFn: async () => {
      // Join journal_entries with transactions
      let q = (supabase as any)
        .from("journal_entries")
        .select("id, transaction_id, debit, credit, memo, transactions!inner(id, ngo_id, transaction_date, description, reference_number, is_void)")
        .eq("account_id", accountId!)
        .eq("transactions.ngo_id", ngoId!)
        .eq("transactions.is_void", false)
        .order("transactions(transaction_date)", { ascending: true });

      if (startDate) q = q.gte("transactions.transaction_date", startDate);
      if (endDate) q = q.lte("transactions.transaction_date", endDate);

      const { data, error } = await q;
      if (error) throw error;

      return ((data || []) as any[]).map((row: any) => ({
        id: row.id,
        transaction_id: row.transaction_id,
        transaction_date: row.transactions.transaction_date,
        description: row.transactions.description,
        reference_number: row.transactions.reference_number,
        debit: Number(row.debit),
        credit: Number(row.credit),
        memo: row.memo,
        is_void: row.transactions.is_void,
      })) as LedgerRow[];
    },
  });
}
