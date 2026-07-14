import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSupabaseNotConfiguredError, supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type {
  FinanceYearEndClose,
  FinanceYearEndCloseReadiness,
  FinanceYearEndPackage,
} from "@/types/financeAccounting";

const ensureSupabase = () => {
  if (!supabase) throw getSupabaseNotConfiguredError();
};

export const useFinanceStatementOfFinancialPosition = (asOfDate: string, ngoId?: string | null) =>
  useQuery({
    queryKey: ["finance-sofp", asOfDate, ngoId ?? "all"],
    enabled: !!supabase && !!asOfDate,
    queryFn: async () => {
      ensureSupabase();
      const { data, error } = await supabase.rpc("finance_statement_of_financial_position" as never, {
        _as_of_date: asOfDate,
        _ngo_id: ngoId ?? null,
      } as never);
      if (error) throw error;
      return data as Record<string, unknown>;
    },
  });

export const useFinanceStatementOfActivities = (startDate: string, endDate: string, ngoId?: string | null) =>
  useQuery({
    queryKey: ["finance-soa", startDate, endDate, ngoId ?? "all"],
    enabled: !!supabase && !!startDate && !!endDate,
    queryFn: async () => {
      ensureSupabase();
      const { data, error } = await supabase.rpc("finance_statement_of_activities" as never, {
        _start_date: startDate,
        _end_date: endDate,
        _ngo_id: ngoId ?? null,
      } as never);
      if (error) throw error;
      return data as Record<string, unknown>;
    },
  });

export const useFinanceStatementOfCashFlows = (startDate: string, endDate: string, ngoId?: string | null) =>
  useQuery({
    queryKey: ["finance-scf", startDate, endDate, ngoId ?? "all"],
    enabled: !!supabase && !!startDate && !!endDate,
    queryFn: async () => {
      ensureSupabase();
      const { data, error } = await supabase.rpc("finance_statement_of_cash_flows" as never, {
        _start_date: startDate,
        _end_date: endDate,
        _ngo_id: ngoId ?? null,
      } as never);
      if (error) throw error;
      return data as Record<string, unknown>;
    },
  });

export const useFinanceTrialBalanceValidation = (startDate: string, endDate: string, ngoId?: string | null) =>
  useQuery({
    queryKey: ["finance-tb-validation", startDate, endDate, ngoId ?? "all"],
    enabled: !!supabase && !!startDate && !!endDate,
    queryFn: async () => {
      ensureSupabase();
      const { data, error } = await supabase.rpc("finance_validate_trial_balance" as never, {
        _start_date: startDate,
        _end_date: endDate,
        _ngo_id: ngoId ?? null,
      } as never);
      if (error) throw error;
      return data as { total_debit: number; total_credit: number; is_balanced: boolean };
    },
  });

export const useFinanceFunctionalExpenseReport = (startDate: string, endDate: string, ngoId?: string | null) =>
  useQuery({
    queryKey: ["finance-functional-expense", startDate, endDate, ngoId ?? "all"],
    enabled: !!supabase && !!startDate && !!endDate,
    queryFn: async () => {
      ensureSupabase();
      const { data, error } = await supabase.rpc("finance_functional_expense_report" as never, {
        _start_date: startDate,
        _end_date: endDate,
        _ngo_id: ngoId ?? null,
      } as never);
      if (error) throw error;
      return data as Record<string, number>;
    },
  });

export const useFinanceRestrictedFundReport = (asOfDate: string, ngoId?: string | null) =>
  useQuery({
    queryKey: ["finance-restricted-funds", asOfDate, ngoId ?? "all"],
    enabled: !!supabase && !!asOfDate,
    queryFn: async () => {
      ensureSupabase();
      const { data, error } = await supabase.rpc("finance_restricted_fund_report" as never, {
        _as_of_date: asOfDate,
        _ngo_id: ngoId ?? null,
      } as never);
      if (error) throw error;
      return data as { funds: Array<Record<string, unknown>>; as_of_date: string };
    },
  });

export const useFinanceBudgetVsActual = (budgetId?: string, startDate?: string, endDate?: string) =>
  useQuery({
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
      return data as Array<{
        account_code: string;
        account_name: string;
        budget_amount: number;
        actual_amount: number;
        variance: number;
      }>;
    },
  });

export const useGenerateYearEndPackage = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ fiscalYear, ngoId, label }: { fiscalYear: number; ngoId?: string | null; label?: string }) => {
      ensureSupabase();
      const { data, error } = await supabase.rpc("generate_finance_year_end_package" as never, {
        _fiscal_year: fiscalYear,
        _ngo_id: ngoId ?? null,
        _label: label ?? null,
      } as never);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["finance-year-end-packages"] });
      toast({ title: "Year-end package generated" });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Error", description: e.message }),
  });
};

export const useFinanceYearEndPackages = (ngoId?: string | null) =>
  useQuery({
    queryKey: ["finance-year-end-packages", ngoId ?? "hpg"],
    enabled: !!supabase,
    queryFn: async () => {
      ensureSupabase();
      let query = supabase
        .from("finance_year_end_packages" as never)
        .select("*")
        .order("fiscal_year", { ascending: false });
      query = ngoId
        ? query.eq("ngo_id" as never, ngoId as never)
        : query.is("ngo_id" as never, null);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as FinanceYearEndPackage[];
    },
  });

export const useFinanceYearEndCloses = (ngoId?: string | null) =>
  useQuery({
    queryKey: ["finance-year-end-closes", ngoId ?? "hpg"],
    enabled: !!supabase,
    queryFn: async (): Promise<FinanceYearEndClose[]> => {
      ensureSupabase();
      let query = supabase
        .from("finance_year_end_closes" as never)
        .select("*")
        .order("fiscal_year", { ascending: false });
      query = ngoId
        ? query.eq("ngo_id" as never, ngoId as never)
        : query.is("ngo_id" as never, null);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as FinanceYearEndClose[];
    },
  });

export const useFinanceYearEndCloseReadiness = (fiscalYear: number, ngoId?: string | null) =>
  useQuery({
    queryKey: ["finance-year-end-close-readiness", fiscalYear, ngoId ?? "hpg"],
    enabled: !!supabase && Number.isInteger(fiscalYear),
    queryFn: async (): Promise<FinanceYearEndCloseReadiness> => {
      ensureSupabase();
      const { data, error } = await supabase.rpc("finance_year_end_close_readiness" as never, {
        _fiscal_year: fiscalYear,
        _ngo_id: ngoId ?? null,
      } as never);
      if (error) throw error;
      return data as unknown as FinanceYearEndCloseReadiness;
    },
  });

export const useFinalizeFinanceYearEnd = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ fiscalYear, ngoId }: { fiscalYear: number; ngoId?: string | null }): Promise<FinanceYearEndClose> => {
      ensureSupabase();
      const { data, error } = await supabase.rpc("finalize_finance_year_end" as never, {
        _fiscal_year: fiscalYear,
        _ngo_id: ngoId ?? null,
      } as never);
      if (error) throw error;
      return data as unknown as FinanceYearEndClose;
    },
    onSuccess: (_, input) => {
      qc.invalidateQueries({ queryKey: ["finance-year-end-closes"] });
      qc.invalidateQueries({ queryKey: ["finance-year-end-packages"] });
      qc.invalidateQueries({ queryKey: ["finance-fiscal-periods"] });
      qc.invalidateQueries({ queryKey: ["finance-year-end-close-readiness", input.fiscalYear] });
      toast({ title: "Fiscal year finalized", description: "All periods are locked and the audit package is immutable." });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Fiscal year not finalized", description: e.message }),
  });
};

export const useReopenFinanceYearEnd = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ fiscalYear, ngoId, reason }: { fiscalYear: number; ngoId?: string | null; reason: string }): Promise<FinanceYearEndClose> => {
      ensureSupabase();
      const { data, error } = await supabase.rpc("reopen_finance_year_end" as never, {
        _fiscal_year: fiscalYear,
        _ngo_id: ngoId ?? null,
        _reason: reason,
      } as never);
      if (error) throw error;
      return data as unknown as FinanceYearEndClose;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["finance-year-end-closes"] });
      qc.invalidateQueries({ queryKey: ["finance-fiscal-periods"] });
      qc.invalidateQueries({ queryKey: ["finance-year-end-close-readiness"] });
      toast({ title: "Fiscal year reopened", description: "The prior audit package remains locked as historical evidence." });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Fiscal year not reopened", description: e.message }),
  });
};

export const logFinanceExport = async (reportType: string, filters: Record<string, unknown> = {}) => {
  if (!supabase) return;
  const { error } = await supabase.rpc("log_finance_export" as never, {
    _report_type: reportType,
    _filters: filters,
  } as never);
  if (error) throw error;
};

export const useSaveFinanceReportSnapshot = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (input: { reportType: string; label: string; filters?: Record<string, unknown>; data: Record<string, unknown> }) => {
      ensureSupabase();
      const { data, error } = await supabase.rpc("save_finance_report_snapshot" as never, {
        _report_type: input.reportType,
        _label: input.label,
        _filters: input.filters ?? {},
        _data: input.data,
      } as never);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["finance-report-snapshots"] });
      toast({ title: "Report snapshot saved" });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Error", description: e.message }),
  });
};

export const useFinanceReportSnapshots = (reportType?: string) =>
  useQuery({
    queryKey: ["finance-report-snapshots", reportType],
    enabled: !!supabase,
    queryFn: async () => {
      ensureSupabase();
      let q = supabase.from("finance_report_snapshots" as never).select("*").order("created_at", { ascending: false });
      if (reportType) q = q.eq("report_type" as never, reportType as never);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });
