import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTrialBalance } from "./useTrialBalance";
import { useFiscalPeriods } from "./useFiscalPeriods";
import { useClosingEntries } from "./useClosingEntries";
import { useAuth } from "@/contexts/AuthContext";

export function useYearEndClose(ngoId?: string, fiscalYear?: number) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: periods } = useFiscalPeriods(ngoId);
  const { data: closingEntries } = useClosingEntries(ngoId, fiscalYear);

  // Filter periods for the selected fiscal year
  const yearPeriods = (periods || []).filter((p) => {
    const y = new Date(p.start_date).getFullYear();
    return y === fiscalYear;
  });

  const allLocked = yearPeriods.length > 0 && yearPeriods.every((p) => (p as any).is_locked);
  const hasClosingEntries = (closingEntries || []).length > 0;

  // Step 3: Generate closing entries (zero out income/expense to retained earnings)
  const generateClosingEntries = useMutation({
    mutationFn: async (trialBalanceRows: { account_id: string; account_type: string; total_debit: number; total_credit: number }[]) => {
      const incomeExpense = trialBalanceRows.filter((r) => r.account_type === "income" || r.account_type === "expense");
      if (incomeExpense.length === 0) throw new Error("No income/expense accounts to close");

      const entries = incomeExpense.map((row) => ({
        ngo_id: ngoId!,
        fiscal_year: fiscalYear!,
        account_id: row.account_id,
        // Reverse the balance: if net credit (income), debit it; if net debit (expense), credit it
        debit: row.total_credit > row.total_debit ? row.total_credit - row.total_debit : 0,
        credit: row.total_debit > row.total_credit ? row.total_debit - row.total_credit : 0,
        memo: `Year-end closing entry for FY${fiscalYear}`,
        created_by_user_id: user?.id || null,
      }));

      const { data, error } = await (supabase as any).from("closing_entries").insert(entries).select();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["closing_entries"] }),
  });

  // Step 4: Lock all periods for the fiscal year
  const lockFiscalYear = useMutation({
    mutationFn: async () => {
      const periodIds = yearPeriods.map((p) => p.id);
      if (periodIds.length === 0) throw new Error("No periods found for this fiscal year");

      for (const id of periodIds) {
        const { error } = await (supabase as any).from("fiscal_periods").update({ is_locked: true }).eq("id", id);
        if (error) throw error;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["fiscal_periods"] }),
  });

  return {
    yearPeriods,
    allLocked,
    hasClosingEntries,
    closingEntries: closingEntries || [],
    generateClosingEntries,
    lockFiscalYear,
  };
}
