import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSupabaseNotConfiguredError, supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { FinanceBankReconciliation, FinanceBankReconciliationItem } from "@/types/financeAccounting";

const ensureSupabase = () => { if (!supabase) throw getSupabaseNotConfiguredError(); };

export const useFinanceReconciliations = (ngoId?: string | null) => useQuery({
  queryKey: ["finance-reconciliations", ngoId ?? "all"],
  enabled: !!supabase,
  queryFn: async (): Promise<FinanceBankReconciliation[]> => {
    ensureSupabase();
    let query = supabase.from("finance_bank_reconciliations" as never).select("*").order("created_at", { ascending: false });
    if (ngoId) query = query.eq("ngo_id" as never, ngoId as never);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map((r: FinanceBankReconciliation) => ({
      ...r,
      beginning_balance: Number(r.beginning_balance),
      ending_balance: Number(r.ending_balance),
      cleared_balance: Number(r.cleared_balance),
      difference: Number(r.difference),
    }));
  },
});

export const useFinanceReconciliationItems = (reconId: string | null) => useQuery({
  queryKey: ["finance-recon-items", reconId],
  enabled: !!supabase && !!reconId,
  queryFn: async (): Promise<FinanceBankReconciliationItem[]> => {
    ensureSupabase();
    const { data, error } = await supabase.from("finance_bank_reconciliation_items" as never).select("*").eq("reconciliation_id" as never, reconId as never).order("transaction_date");
    if (error) throw error;
    return (data || []).map((i: FinanceBankReconciliationItem) => ({ ...i, amount: Number(i.amount) }));
  },
});

export const useCreateReconciliation = () => {
  const qc = useQueryClient(); const { toast } = useToast();
  return useMutation({
    mutationFn: async (input: { ngo_id: string; bank_account_id: string; statement_start_date: string; statement_end_date: string; beginning_balance: number; ending_balance: number }) => {
      ensureSupabase();
      const { data, error } = await supabase.rpc("start_finance_bank_reconciliation" as never, {
        _ngo_id: input.ngo_id,
        _bank_account_id: input.bank_account_id,
        _statement_start_date: input.statement_start_date,
        _statement_end_date: input.statement_end_date,
        _beginning_balance: input.beginning_balance,
        _ending_balance: input.ending_balance,
        _statement_import_id: null,
      } as never);
      if (error) throw error;
      return data as FinanceBankReconciliation;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["finance-reconciliations"] }); toast({ title: "Reconciliation started" }); },
    onError: (e: Error) => toast({ variant: "destructive", title: "Could not create reconciliation", description: e.message }),
  });
};

export const useToggleReconItemCleared = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ itemId, isCleared }: { itemId: string; isCleared: boolean }) => {
      ensureSupabase();
      const { error } = await supabase.from("finance_bank_reconciliation_items" as never).update({ is_cleared: isCleared } as never).eq("id" as never, itemId as never).is("locked_at" as never, null);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["finance-recon-items"] }),
  });
};

export const useRefreshReconciliationBalances = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (reconId: string) => {
      ensureSupabase();
      const { data, error } = await supabase.rpc("refresh_finance_bank_reconciliation_balances" as never, {
        _recon_id: reconId,
      } as never);
      if (error) throw error;
      return data as FinanceBankReconciliation;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["finance-reconciliations"] });
      qc.invalidateQueries({ queryKey: ["finance-recon-items"] });
      toast({ title: "Balances refreshed" });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Could not refresh", description: e.message }),
  });
};

export const useFinalizeReconciliation = () => {
  const qc = useQueryClient(); const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, exceptionNotes }: { id: string; exceptionNotes?: string }) => {
      ensureSupabase();
      const { data, error } = await supabase.rpc("finalize_finance_bank_reconciliation" as never, { _recon_id: id, _exception_notes: exceptionNotes ?? null } as never);
      if (error) throw error;
      return data as FinanceBankReconciliation;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["finance-reconciliations"] }); toast({ title: "Reconciliation finalized" }); },
    onError: (e: Error) => toast({ variant: "destructive", title: "Could not finalize", description: e.message }),
  });
};
