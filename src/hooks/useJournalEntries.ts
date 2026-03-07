import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface JournalEntry {
  id: string;
  transaction_id: string;
  account_id: string;
  debit: number;
  credit: number;
  memo: string | null;
  created_at: string;
}

export function useJournalEntries(transactionId?: string) {
  return useQuery({
    queryKey: ["journal_entries", transactionId],
    enabled: !!transactionId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("journal_entries")
        .select("*")
        .eq("transaction_id", transactionId!)
        .order("created_at");
      if (error) throw error;
      return (data || []) as JournalEntry[];
    },
  });
}
