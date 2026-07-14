import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSupabaseNotConfiguredError, supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import type { FinanceAdminFeeCalculation, FinanceAdminFeeRule, FinanceDeposit, FinanceDepositInput, FinanceDepositLine, FinanceDepositLineInput } from "@/types/financeAccounting";

const ensureSupabase = () => { if (!supabase) throw getSupabaseNotConfiguredError(); };

const normalizeLines = (lines: FinanceDepositLineInput[]) =>
  lines.filter((l) => l.revenue_account_id && l.amount > 0).map((l, i) => ({ ...l, amount: Number(l.amount), line_number: i + 1 }));

export const useFinanceDeposits = (ngoId?: string | null) => useQuery({
  queryKey: ["finance-deposits", ngoId ?? "all"],
  enabled: !!supabase,
  queryFn: async (): Promise<FinanceDeposit[]> => {
    ensureSupabase();
    let depositQuery = supabase.from("finance_deposits" as never).select("*").order("deposit_date", { ascending: false });
    if (ngoId) depositQuery = depositQuery.eq("ngo_id" as never, ngoId as never);
    const { data: deps, error } = await depositQuery;
    if (error) throw error;
    if (!deps?.length) return [];
    const ids = deps.map((d: FinanceDeposit) => d.id);
    const { data: lines, error: le } = await supabase.from("finance_deposit_lines" as never).select("*").in("deposit_id" as never, ids as never);
    if (le) throw le;
    const byDep = new Map<string, FinanceDepositLine[]>();
    (lines || []).forEach((l: FinanceDepositLine) => {
      const b = byDep.get(l.deposit_id) || []; b.push({ ...l, amount: Number(l.amount) }); byDep.set(l.deposit_id, b);
    });
    return (deps as FinanceDeposit[]).map((d) => ({ ...d, total_amount: Number(d.total_amount), lines: byDep.get(d.id) || [] }));
  },
});

export const useSaveFinanceDeposit = () => {
  const qc = useQueryClient(); const { toast } = useToast(); const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: FinanceDepositInput }) => {
      ensureSupabase();
      const lines = normalizeLines(input.lines);
      const header = {
        deposit_date: input.deposit_date, source_type: input.source_type, bank_account_id: input.bank_account_id,
        ngo_id: input.ngo_id,
        memo: input.memo?.trim() || null, document_id: input.document_id || null, restriction_notes: input.restriction_notes?.trim() || null,
      };
      if (id) {
        const { data, error } = await supabase.from("finance_deposits" as never).update(header as never).eq("id" as never, id as never).select().single();
        if (error) throw error;
        await supabase.from("finance_deposit_lines" as never).delete().eq("deposit_id" as never, id as never);
        if (lines.length) await supabase.from("finance_deposit_lines" as never).insert(lines.map((l) => ({ ...l, deposit_id: id })) as never);
        return data as FinanceDeposit;
      }
      const { data, error } = await supabase.from("finance_deposits" as never).insert({
        ...header, status: "draft", created_by_user_id: user?.id ?? null, deposit_number: "",
      } as never).select().single();
      if (error) throw error;
      const depId = (data as FinanceDeposit).id;
      if (lines.length) await supabase.from("finance_deposit_lines" as never).insert(lines.map((l) => ({ ...l, deposit_id: depId })) as never);
      return data as FinanceDeposit;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["finance-deposits"] }); toast({ title: "Deposit saved" }); },
    onError: (e: Error) => toast({ variant: "destructive", title: "Could not save deposit", description: e.message }),
  });
};

export const usePostFinanceDeposit = () => {
  const qc = useQueryClient(); const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      ensureSupabase();
      const { data, error } = await supabase.rpc("post_finance_deposit" as never, { _deposit_id: id } as never);
      if (error) throw error;
      return data as FinanceDeposit;
    },
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ["finance-deposits"] }); qc.invalidateQueries({ queryKey: ["finance-journal-entries"] });
      qc.invalidateQueries({ queryKey: ["finance-bank-accounts"] });
      toast({ title: "Deposit posted", description: d.deposit_number });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Could not post deposit", description: e.message }),
  });
};

export const useCalculateAdminFee = (amount: number, ngoId?: string | null, grantId?: string | null) => useQuery({
  queryKey: ["finance-admin-fee-calc", amount, ngoId, grantId],
  enabled: !!supabase && amount > 0,
  queryFn: async (): Promise<FinanceAdminFeeCalculation | null> => {
    ensureSupabase();
    const { data, error } = await supabase.rpc("finance_calculate_admin_fee" as never, {
      _amount: amount, _ngo_id: ngoId ?? null, _grant_id: grantId ?? null,
    } as never);
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return null;
    return row as FinanceAdminFeeCalculation;
  },
});

export const useFinanceAdminFeeRules = () => useQuery({
  queryKey: ["finance-admin-fee-rules"],
  enabled: !!supabase,
  queryFn: async (): Promise<FinanceAdminFeeRule[]> => {
    ensureSupabase();
    const { data, error } = await supabase.from("finance_admin_fee_rules" as never).select("*").order("created_at");
    if (error) throw error;
    return (data || []) as FinanceAdminFeeRule[];
  },
});

export const useSaveAdminFeeRule = () => {
  const qc = useQueryClient(); const { toast } = useToast();
  return useMutation({
    mutationFn: async (input: Partial<FinanceAdminFeeRule> & { id?: string }) => {
      ensureSupabase();
      const { id, ...rest } = input;
      if (id) {
        const { data, error } = await supabase.from("finance_admin_fee_rules" as never).update(rest as never).eq("id" as never, id as never).select().single();
        if (error) throw error; return data;
      }
      const { data, error } = await supabase.from("finance_admin_fee_rules" as never).insert(rest as never).select().single();
      if (error) throw error; return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["finance-admin-fee-rules"] }); toast({ title: "Admin fee rule saved" }); },
    onError: (e: Error) => toast({ variant: "destructive", title: "Could not save rule", description: e.message }),
  });
};
