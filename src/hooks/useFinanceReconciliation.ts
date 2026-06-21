import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSupabaseNotConfiguredError, supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import type { FinanceBankReconciliation, FinanceBankReconciliationItem } from "@/types/financeAccounting";

const ensureSupabase = () => { if (!supabase) throw getSupabaseNotConfiguredError(); };

export const useFinanceReconciliations = () => useQuery({
  queryKey: ["finance-reconciliations"],
  enabled: !!supabase,
  queryFn: async (): Promise<FinanceBankReconciliation[]> => {
    ensureSupabase();
    const { data, error } = await supabase.from("finance_bank_reconciliations" as never).select("*").order("created_at", { ascending: false });
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
  const qc = useQueryClient(); const { toast } = useToast(); const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: { bank_account_id: string; statement_start_date: string; statement_end_date: string; beginning_balance: number; ending_balance: number }) => {
      ensureSupabase();
      const { data, error } = await supabase.from("finance_bank_reconciliations" as never).insert({
        ...input, created_by_user_id: user?.id ?? null, status: "in_progress",
      } as never).select().single();
      if (error) throw error;
      const recon = data as FinanceBankReconciliation;
      const { data: bank } = await supabase.from("finance_bank_accounts" as never).select("linked_finance_account_id").eq("id" as never, input.bank_account_id as never).single();
      if (bank) {
        const { data: lines } = await supabase.from("finance_journal_lines" as never)
          .select("id, debit, credit, memo, created_at, journal_entry_id")
          .eq("account_id" as never, (bank as { linked_finance_account_id: string }).linked_finance_account_id as never);
        const entryIds = [...new Set((lines || []).map((l: { journal_entry_id: string }) => l.journal_entry_id))];
        const { data: entries } = entryIds.length ? await supabase.from("finance_journal_entries" as never).select("id, entry_date, status").in("id" as never, entryIds as never).eq("status" as never, "posted" as never) : { data: [] };
        const postedIds = new Set((entries || []).map((e: { id: string }) => e.id));
        const items = (lines || []).filter((l: { journal_entry_id: string }) => postedIds.has(l.journal_entry_id)).map((l: { id: string; debit: number; credit: number; memo: string | null; journal_entry_id: string }, idx: number) => {
          const entry = (entries || []).find((e: { id: string; entry_date: string }) => e.id === l.journal_entry_id);
          const amt = Number(l.debit) - Number(l.credit);
          return { reconciliation_id: recon.id, journal_line_id: l.id, transaction_date: entry?.entry_date ?? null, description: l.memo, amount: amt, is_cleared: false, line_number: idx };
        });
        if (items.length) await supabase.from("finance_bank_reconciliation_items" as never).insert(items as never);
      }
      return recon;
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
