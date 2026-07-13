import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSupabaseNotConfiguredError, supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
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
  const qc = useQueryClient(); const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, header, lines }: { id?: string; header: Partial<FinanceBudget>; lines?: FinanceBudgetLineInput[] }) => {
      ensureSupabase();
      const { data, error } = await supabase.rpc("save_finance_budget" as never, {
        _budget_id: id ?? null,
        _header: header,
        _lines: lines ?? null,
      } as never);
      if (error) throw error;
      return data as unknown as FinanceBudget;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["finance-budgets"] }); toast({ title: "Budget saved" }); },
    onError: (e: Error) => toast({ variant: "destructive", title: "Could not save budget", description: e.message }),
  });
};

const invalidateBudgetWorkflow = (qc: ReturnType<typeof useQueryClient>) => {
  void qc.invalidateQueries({ queryKey: ["finance-budgets"] });
  void qc.invalidateQueries({ queryKey: ["finance-workflow-events"] });
  void qc.invalidateQueries({ queryKey: ["finance-hub-snapshot"] });
  void qc.invalidateQueries({ queryKey: ["work-items"] });
};

export const useSubmitFinanceBudget = () => {
  const qc = useQueryClient(); const { toast } = useToast();
  return useMutation({
    mutationFn: async (budgetId: string) => {
      ensureSupabase();
      const { data, error } = await supabase.rpc("submit_finance_budget" as never, { _budget_id: budgetId } as never);
      if (error) throw error;
      return data as unknown as FinanceBudget;
    },
    onSuccess: () => { invalidateBudgetWorkflow(qc); toast({ title: "Budget submitted for approval" }); },
    onError: (e: Error) => toast({ variant: "destructive", title: "Could not submit budget", description: e.message }),
  });
};

export const useReviewFinanceBudget = () => {
  const qc = useQueryClient(); const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, decision, reason }: { id: string; decision: "approved" | "rejected"; reason?: string }) => {
      ensureSupabase();
      const { data, error } = await supabase.rpc("review_finance_budget" as never, {
        _budget_id: id,
        _decision: decision,
        _reason: reason ?? null,
      } as never);
      if (error) throw error;
      return data as unknown as FinanceBudget;
    },
    onSuccess: (_, variables) => { invalidateBudgetWorkflow(qc); toast({ title: `Budget ${variables.decision}` }); },
    onError: (e: Error) => toast({ variant: "destructive", title: "Could not review budget", description: e.message }),
  });
};

export const useBudgetVsActual = (budgetId: string | null, startDate?: string, endDate?: string) => useQuery({
  queryKey: ["finance-budget-vs-actual", budgetId, startDate, endDate],
  enabled: !!supabase && !!budgetId,
  queryFn: async () => {
    ensureSupabase();
    const { data, error } = await supabase.rpc("finance_budget_vs_actual_report" as never, {
      _budget_id: budgetId,
      _start_date: startDate ?? null,
      _end_date: endDate ?? null,
    } as never);
    if (error) throw error;
    return (data || []) as Array<{
      account_id: string;
      account_code: string;
      account_name: string;
      budget_amount: number;
      actual_amount: number;
      variance: number;
    }>;
  },
});
