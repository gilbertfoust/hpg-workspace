import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ensureSupabase, supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const FINANCE_CUTOVER_METRIC_KEYS = [
  "trial_balance_debits",
  "trial_balance_credits",
  "total_assets",
  "total_liabilities_and_net_assets",
  "total_revenue",
  "total_expenses",
  "ending_cash",
  "accounts_receivable",
  "accounts_payable",
] as const;

export type FinanceCutoverMetricKey = typeof FINANCE_CUTOVER_METRIC_KEYS[number];
export type FinanceCutoverMetrics = Record<FinanceCutoverMetricKey, number>;

export const FINANCE_CUTOVER_METRIC_LABELS: Record<FinanceCutoverMetricKey, string> = {
  trial_balance_debits: "Trial balance debits",
  trial_balance_credits: "Trial balance credits",
  total_assets: "Total assets",
  total_liabilities_and_net_assets: "Liabilities + net assets",
  total_revenue: "Total revenue",
  total_expenses: "Total expenses",
  ending_cash: "Ending cash",
  accounts_receivable: "Accounts receivable",
  accounts_payable: "Accounts payable",
};

export interface FinanceParallelCloseComparison {
  id: string;
  ngo_id: string;
  comparison_start_date: string;
  comparison_end_date: string;
  prior_system_name: string;
  prior_source_document_id: string;
  prior_metrics: FinanceCutoverMetrics;
  system_metrics: FinanceCutoverMetrics & { ecosystem_is_balanced: boolean; captured_at: string };
  variances: FinanceCutoverMetrics;
  tolerance: number;
  is_matched: boolean;
  status: "variance" | "matched" | "approved";
  notes: string | null;
  approved_at: string | null;
  created_at: string;
}

export interface FinanceGoLiveCertification {
  id: string;
  ngo_id: string;
  cutover_date: string;
  status: "draft" | "ready" | "live" | "suspended";
  opening_balance_mode: "imported" | "new_zero_balance";
  zero_balance_attested: boolean;
  bank_data_mode: "manual_csv" | "provider";
  parallel_close_id: string | null;
  coa_approved: boolean;
  restricted_funds_reviewed: boolean;
  ap_ar_reviewed: boolean;
  access_reviewed: boolean;
  receipt_workflow_verified: boolean;
  historical_archive_retained: boolean;
  accountant_name: string | null;
  accountant_credential: string | null;
  accountant_attestation: string | null;
  accountant_signoff_document_id: string | null;
  accountant_signed_at: string | null;
  activated_at: string | null;
  suspension_reason: string | null;
  readiness_snapshot: FinanceGoLiveReadiness | null;
}

export interface FinanceGoLiveCheck {
  key: string;
  label: string;
  passed: boolean;
  blocking: boolean;
  detail?: string;
}

export interface FinanceGoLiveReadiness {
  ngo_id: string;
  certification_id: string | null;
  status: "not_started" | FinanceGoLiveCertification["status"];
  is_ready: boolean;
  is_system_of_record: boolean;
  cutover_date: string | null;
  checks: FinanceGoLiveCheck[];
  blockers: string[];
  checked_at: string;
}

const invalidateGoLive = (queryClient: ReturnType<typeof useQueryClient>) => {
  void queryClient.invalidateQueries({ queryKey: ["finance-go-live-readiness"] });
  void queryClient.invalidateQueries({ queryKey: ["finance-go-live-certification"] });
  void queryClient.invalidateQueries({ queryKey: ["finance-parallel-close-comparisons"] });
  void queryClient.invalidateQueries({ queryKey: ["finance-accounting-integrity"] });
};

export const useFinanceGoLiveReadiness = (ngoId?: string | null) =>
  useQuery({
    queryKey: ["finance-go-live-readiness", ngoId ?? "none"],
    enabled: !!supabase && !!ngoId,
    queryFn: async (): Promise<FinanceGoLiveReadiness> => {
      const client = ensureSupabase();
      const { data, error } = await client.rpc("finance_go_live_readiness" as never, { _ngo_id: ngoId } as never);
      if (error) throw error;
      return data as unknown as FinanceGoLiveReadiness;
    },
  });

export const useFinanceGoLiveCertification = (ngoId?: string | null) =>
  useQuery({
    queryKey: ["finance-go-live-certification", ngoId ?? "none"],
    enabled: !!supabase && !!ngoId,
    queryFn: async (): Promise<FinanceGoLiveCertification | null> => {
      const client = ensureSupabase();
      const { data, error } = await client
        .from("finance_go_live_certifications" as never)
        .select("*")
        .eq("ngo_id" as never, ngoId as never)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as FinanceGoLiveCertification | null;
    },
  });

export const useFinanceParallelCloseComparisons = (ngoId?: string | null) =>
  useQuery({
    queryKey: ["finance-parallel-close-comparisons", ngoId ?? "none"],
    enabled: !!supabase && !!ngoId,
    queryFn: async (): Promise<FinanceParallelCloseComparison[]> => {
      const client = ensureSupabase();
      const { data, error } = await client
        .from("finance_parallel_close_comparisons" as never)
        .select("*")
        .eq("ngo_id" as never, ngoId as never)
        .order("created_at" as never, { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row) => ({ ...row, tolerance: Number(row.tolerance) })) as unknown as FinanceParallelCloseComparison[];
    },
  });

export const useSaveFinanceParallelClose = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      ngoId: string;
      startDate: string;
      endDate: string;
      priorSystemName: string;
      priorSourceDocumentId: string;
      priorMetrics: FinanceCutoverMetrics;
      tolerance: number;
      notes?: string;
    }) => {
      const client = ensureSupabase();
      const { data, error } = await client.rpc("save_finance_parallel_close" as never, {
        _ngo_id: input.ngoId,
        _start_date: input.startDate,
        _end_date: input.endDate,
        _prior_system_name: input.priorSystemName,
        _prior_source_document_id: input.priorSourceDocumentId,
        _prior_metrics: input.priorMetrics,
        _tolerance: input.tolerance,
        _notes: input.notes?.trim() || null,
      } as never);
      if (error) throw error;
      return data as unknown as FinanceParallelCloseComparison;
    },
    onSuccess: (comparison) => {
      invalidateGoLive(queryClient);
      toast[comparison.is_matched ? "success" : "warning"](
        comparison.is_matched ? "Parallel close matches the live ledger" : "Parallel close has variances to resolve",
      );
    },
    onError: (error: Error) => toast.error(error.message),
  });
};

export const useApproveFinanceParallelClose = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (comparisonId: string) => {
      const client = ensureSupabase();
      const { data, error } = await client.rpc("approve_finance_parallel_close" as never, {
        _comparison_id: comparisonId,
      } as never);
      if (error) throw error;
      return data as unknown as FinanceParallelCloseComparison;
    },
    onSuccess: () => {
      invalidateGoLive(queryClient);
      toast.success("Parallel close approved");
    },
    onError: (error: Error) => toast.error(error.message),
  });
};

export const useSaveFinanceGoLiveCertification = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ ngoId, payload }: { ngoId: string; payload: Record<string, unknown> }) => {
      const client = ensureSupabase();
      const { data, error } = await client.rpc("save_finance_go_live_certification" as never, {
        _ngo_id: ngoId,
        _payload: payload,
      } as never);
      if (error) throw error;
      return data as unknown as FinanceGoLiveCertification;
    },
    onSuccess: (certification) => {
      invalidateGoLive(queryClient);
      toast.success(certification.status === "ready" ? "Go-live package is ready for activation" : "Go-live package saved");
    },
    onError: (error: Error) => toast.error(error.message),
  });
};

export const useActivateFinanceSystemOfRecord = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ngoId: string) => {
      const client = ensureSupabase();
      const { data, error } = await client.rpc("activate_finance_system_of_record" as never, { _ngo_id: ngoId } as never);
      if (error) throw error;
      return data as unknown as FinanceGoLiveCertification;
    },
    onSuccess: () => {
      invalidateGoLive(queryClient);
      toast.success("HPG Finance is now the system of record for this NGO");
    },
    onError: (error: Error) => toast.error(error.message),
  });
};

export const useSuspendFinanceSystemOfRecord = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ ngoId, reason }: { ngoId: string; reason: string }) => {
      const client = ensureSupabase();
      const { data, error } = await client.rpc("suspend_finance_system_of_record" as never, {
        _ngo_id: ngoId,
        _reason: reason,
      } as never);
      if (error) throw error;
      return data as unknown as FinanceGoLiveCertification;
    },
    onSuccess: () => {
      invalidateGoLive(queryClient);
      toast.warning("System-of-record status suspended");
    },
    onError: (error: Error) => toast.error(error.message),
  });
};
