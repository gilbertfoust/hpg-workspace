import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TrialBalanceRow {
  account_id: string;
  account_code: string;
  account_name: string;
  account_type: string;
  total_debit: number;
  total_credit: number;
}

export function useTrialBalance(ngoId?: string, fiscalPeriodId?: string) {
  return useQuery({
    queryKey: ["trial_balance", ngoId, fiscalPeriodId],
    enabled: !!ngoId,
    queryFn: async () => {
      // Fetch non-void journal entries with their transaction + account info
      let q = (supabase as any)
        .from("journal_entries")
        .select("debit, credit, account_id, accounts!inner(id, code, name, type), transactions!inner(id, ngo_id, fiscal_period_id, is_void)")
        .eq("transactions.ngo_id", ngoId!)
        .eq("transactions.is_void", false);

      if (fiscalPeriodId) q = q.eq("transactions.fiscal_period_id", fiscalPeriodId);

      const { data, error } = await q;
      if (error) throw error;

      // Aggregate by account
      const map = new Map<string, TrialBalanceRow>();
      for (const row of (data || []) as any[]) {
        const aid = row.account_id;
        if (!map.has(aid)) {
          map.set(aid, {
            account_id: aid,
            account_code: row.accounts.code,
            account_name: row.accounts.name,
            account_type: row.accounts.type,
            total_debit: 0,
            total_credit: 0,
          });
        }
        const entry = map.get(aid)!;
        entry.total_debit += Number(row.debit);
        entry.total_credit += Number(row.credit);
      }

      return Array.from(map.values()).sort((a, b) => a.account_code.localeCompare(b.account_code));
    },
  });
}
