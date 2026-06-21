import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSupabaseNotConfiguredError, supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import type { FinanceBudget, FinanceBudgetLine, FinanceBudgetLineInput } from "@/types/financeAccounting";

const ensureSupabase = () => { if (!supabase) throw getSupabaseNotConfiguredError(); };

export const useFinanceBudgets = () => useQuery({
  queryKey: ["finance-budgets"],
  enabled: !!supabase,
  queryFn: async (): Promise<FinanceBudget[]> => {
    ensureSupabase();
    const { data, error } = await supabase.from("finance_budgets" as never).select("*").order("fiscal_year", { ascending: false });
    if (error) throw error;
    if (!data?.length) return [];
    const ids = data.map((b: FinanceBudget) => b.id);
    const { data: lines } = await supabase.from("finance_budget_lines" as never).select("*").in("budget_id" as never, ids as never);
    const byBudget = new Map<string, FinanceBudgetLine[]>();
    (lines || []).forEach((l: FinanceBudgetLine) => {
      const b = byBudget.get(l.budget_id) || []; b.push({ ...l, amount: Number(l.amount) }); byBudget.set(l.budget_id, b);
    });
    return (data as FinanceBudget[]).map((b) => ({ ...b, lines: byBudget.get(b.id) || [] }));
  },
});

export const useSaveFinanceBudget = () => {
  const qc = useQueryClient(); const { toast } = useToast(); const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ id, header, lines }: { id?: string; header: Partial<FinanceBudget>; lines?: FinanceBudgetLineInput[] }) => {
      ensureSupabase();
      if (id) {
        const { data, error } = await supabase.from("finance_budgets" as never).update(header as never).eq("id" as never, id as never).select().single();
        if (error) throw error;
        if (lines) {
          await supabase.from("finance_budget_lines" as never).delete().eq("budget_id" as never, id as never);
          if (lines.length) await supabase.from("finance_budget_lines" as never).insert(lines.map((l) => ({ ...l, budget_id: id })) as never);
        }
        return data;
      }
      const { data, error } = await supabase.from("finance_budgets" as never).insert({ ...header, created_by_user_id: user?.id ?? null } as never).select().single();
      if (error) throw error;
      const budgetId = (data as FinanceBudget).id;
      if (lines?.length) await supabase.from("finance_budget_lines" as never).insert(lines.map((l) => ({ ...l, budget_id: budgetId })) as never);
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["finance-budgets"] }); toast({ title: "Budget saved" }); },
    onError: (e: Error) => toast({ variant: "destructive", title: "Could not save budget", description: e.message }),
  });
};

export const useBudgetVsActual = (budgetId: string | null, fiscalYear: number) => useQuery({
  queryKey: ["finance-budget-vs-actual", budgetId, fiscalYear],
  enabled: !!supabase && !!budgetId,
  queryFn: async () => {
    ensureSupabase();
    const { data: budgetLines } = await supabase.from("finance_budget_lines" as never).select("*").eq("budget_id" as never, budgetId as never);
    const { data: entries } = await supabase.from("finance_journal_entries" as never).select("id").eq("status" as never, "posted" as never)
      .gte("entry_date" as never, `${fiscalYear}-01-01`).lte("entry_date" as never, `${fiscalYear}-12-31`);
    const entryIds = (entries || []).map((e: { id: string }) => e.id);
    const { data: jl } = entryIds.length ? await supabase.from("finance_journal_lines" as never).select("account_id, debit, credit, journal_entry_id").in("journal_entry_id" as never, entryIds as never) : { data: [] };
    const actualByAccount = new Map<string, number>();
    (jl || []).forEach((l: { account_id: string; debit: number; credit: number }) => {
      actualByAccount.set(l.account_id, (actualByAccount.get(l.account_id) || 0) + Number(l.debit) - Number(l.credit));
    });
    return (budgetLines || []).map((bl: FinanceBudgetLine) => ({
      account_id: bl.account_id, period_month: bl.period_month,
      budget: Number(bl.amount), actual: actualByAccount.get(bl.account_id) || 0,
      variance: (actualByAccount.get(bl.account_id) || 0) - Number(bl.amount),
    }));
  },
});
