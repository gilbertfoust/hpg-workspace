import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSupabaseNotConfiguredError, supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { FinanceFiscalPeriod, FinanceOpeningBalance } from "@/types/financeAccounting";

const ensureSupabase = () => {
  if (!supabase) throw getSupabaseNotConfiguredError();
};

export const useFinanceFiscalPeriods = (ngoId?: string | null) =>
  useQuery({
    queryKey: ["finance-fiscal-periods", ngoId ?? "hpg"],
    enabled: !!supabase,
    queryFn: async (): Promise<FinanceFiscalPeriod[]> => {
      ensureSupabase();
      let query = supabase
        .from("finance_fiscal_periods" as never)
        .select("*")
        .order("fiscal_year", { ascending: false })
        .order("start_date", { ascending: true });
      query = ngoId
        ? query.eq("ngo_id" as never, ngoId as never)
        : query.is("ngo_id" as never, null);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as FinanceFiscalPeriod[];
    },
  });

export const useFinanceOpeningBalances = (periodId?: string) =>
  useQuery({
    queryKey: ["finance-opening-balances", periodId],
    enabled: !!supabase && !!periodId,
    queryFn: async (): Promise<FinanceOpeningBalance[]> => {
      ensureSupabase();
      const { data, error } = await supabase
        .from("finance_opening_balances" as never)
        .select("*")
        .eq("fiscal_period_id" as never, periodId as never);
      if (error) throw error;
      return (data || []) as FinanceOpeningBalance[];
    },
  });

export const useCreateFinanceFiscalPeriod = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (input: Omit<FinanceFiscalPeriod, "id" | "created_at" | "updated_at" | "closed_at" | "locked_at" | "reopen_reason">) => {
      ensureSupabase();
      const { data, error } = await supabase.from("finance_fiscal_periods" as never).insert(input as never).select().single();
      if (error) throw error;
      return data as FinanceFiscalPeriod;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["finance-fiscal-periods"] });
      toast({ title: "Fiscal period created" });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Error", description: e.message }),
  });
};

export const useCloseFinanceFiscalPeriod = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (periodId: string) => {
      ensureSupabase();
      const { data, error } = await supabase.rpc("close_finance_fiscal_period" as never, { _period_id: periodId } as never);
      if (error) throw error;
      return data as FinanceFiscalPeriod;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["finance-fiscal-periods"] });
      toast({ title: "Period closed" });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Error", description: e.message }),
  });
};

export const useLockFinanceFiscalPeriod = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (periodId: string) => {
      ensureSupabase();
      const { data, error } = await supabase.rpc("lock_finance_fiscal_period" as never, { _period_id: periodId } as never);
      if (error) throw error;
      return data as FinanceFiscalPeriod;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["finance-fiscal-periods"] });
      toast({ title: "Period locked" });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Error", description: e.message }),
  });
};

export const useReopenFinanceFiscalPeriod = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ periodId, reason }: { periodId: string; reason: string }) => {
      ensureSupabase();
      const { data, error } = await supabase.rpc("reopen_finance_fiscal_period" as never, {
        _period_id: periodId,
        _reason: reason,
      } as never);
      if (error) throw error;
      return data as FinanceFiscalPeriod;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["finance-fiscal-periods"] });
      toast({ title: "Period reopened" });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Error", description: e.message }),
  });
};

export const useUpsertFinanceOpeningBalance = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (input: {
      fiscal_period_id: string;
      account_id: string;
      debit?: number;
      credit?: number;
      fund_id?: string | null;
      ngo_id?: string | null;
      memo?: string | null;
    }) => {
      ensureSupabase();
      const { data, error } = await supabase.rpc("upsert_finance_opening_balance" as never, {
        _fiscal_period_id: input.fiscal_period_id,
        _account_id: input.account_id,
        _debit: input.debit ?? 0,
        _credit: input.credit ?? 0,
        _fund_id: input.fund_id ?? null,
        _ngo_id: input.ngo_id ?? null,
        _memo: input.memo ?? null,
      } as never);
      if (error) throw error;
      return data as FinanceOpeningBalance;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["finance-opening-balances", vars.fiscal_period_id] });
      toast({ title: "Opening balance saved" });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Error", description: e.message }),
  });
};
