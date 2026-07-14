import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ensureSupabase, supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface FinanceRecurringRule {
  id: string;
  ngo_id: string;
  name: string;
  cadence: "weekly" | "monthly" | "quarterly" | "annual";
  interval_count: number;
  start_date: string;
  end_date: string | null;
  next_run_on: string;
  template_json: {
    memo?: string;
    lines?: Array<{ account_id: string; debit: number; credit: number; memo?: string }>;
  };
  status: "active" | "paused" | "ended";
  last_generated_at: string | null;
  created_at: string;
}

export interface FinanceRecurringOccurrence {
  id: string;
  rule_id: string;
  ngo_id: string;
  occurrence_date: string;
  status: "draft_generated" | "skipped" | "failed";
  journal_entry_id: string | null;
  error_message: string | null;
  created_at: string;
}

export interface FinanceFinancialConnection {
  id: string;
  ngo_id: string;
  bank_account_id: string;
  provider: string;
  institution_name: string | null;
  status: "pending" | "active" | "reauthorization_required" | "disabled" | "error";
  last_synced_at: string | null;
  last_error: string | null;
  created_at: string;
}

export interface FinanceFeedSyncRun {
  id: string;
  connection_id: string;
  ngo_id: string;
  requested_from: string | null;
  requested_through: string | null;
  status: "queued" | "running" | "succeeded" | "failed" | "canceled";
  imported_count: number;
  duplicate_count: number;
  error_message: string | null;
  created_at: string;
}

export interface FinancePaymentIntent {
  id: string;
  ngo_id: string;
  payment_id: string;
  provider: string;
  amount: number;
  currency: string;
  status: "queued" | "submitted" | "processing" | "settled" | "failed" | "canceled";
  provider_reference: string | null;
  failure_message: string | null;
  created_at: string;
}

export interface FinanceIntegrationOutboxItem {
  id: string;
  ngo_id: string;
  event_type: "bank_feed_sync_requested" | "payment_submission_requested";
  status: "pending" | "processing" | "sent" | "failed" | "canceled";
  attempt_count: number;
  last_error: string | null;
  created_at: string;
}

const invalidateAutomation = (queryClient: ReturnType<typeof useQueryClient>) => {
  void queryClient.invalidateQueries({ queryKey: ["finance-recurring-rules"] });
  void queryClient.invalidateQueries({ queryKey: ["finance-recurring-occurrences"] });
  void queryClient.invalidateQueries({ queryKey: ["finance-feed-sync-runs"] });
  void queryClient.invalidateQueries({ queryKey: ["finance-integration-outbox"] });
  void queryClient.invalidateQueries({ queryKey: ["finance-journal-entries"] });
  void queryClient.invalidateQueries({ queryKey: ["finance-accounting-integrity"] });
};

export const useFinanceRecurringRules = (ngoId?: string | null) =>
  useQuery({
    queryKey: ["finance-recurring-rules", ngoId ?? "none"],
    enabled: !!supabase && !!ngoId,
    queryFn: async (): Promise<FinanceRecurringRule[]> => {
      const client = ensureSupabase();
      const { data, error } = await client
        .from("finance_recurring_rules" as never)
        .select("*")
        .eq("ngo_id" as never, ngoId as never)
        .order("next_run_on" as never, { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as FinanceRecurringRule[];
    },
  });

export const useFinanceRecurringOccurrences = (ngoId?: string | null) =>
  useQuery({
    queryKey: ["finance-recurring-occurrences", ngoId ?? "none"],
    enabled: !!supabase && !!ngoId,
    queryFn: async (): Promise<FinanceRecurringOccurrence[]> => {
      const client = ensureSupabase();
      const { data, error } = await client
        .from("finance_recurring_occurrences" as never)
        .select("*")
        .eq("ngo_id" as never, ngoId as never)
        .order("created_at" as never, { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as unknown as FinanceRecurringOccurrence[];
    },
  });

export const useFinanceConnections = (ngoId?: string | null) =>
  useQuery({
    queryKey: ["finance-financial-connections", ngoId ?? "none"],
    enabled: !!supabase && !!ngoId,
    queryFn: async (): Promise<FinanceFinancialConnection[]> => {
      const client = ensureSupabase();
      const { data, error } = await client
        .from("finance_financial_connections" as never)
        .select("*")
        .eq("ngo_id" as never, ngoId as never)
        .order("created_at" as never, { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as FinanceFinancialConnection[];
    },
  });

export const useFinanceFeedSyncRuns = (ngoId?: string | null) =>
  useQuery({
    queryKey: ["finance-feed-sync-runs", ngoId ?? "none"],
    enabled: !!supabase && !!ngoId,
    queryFn: async (): Promise<FinanceFeedSyncRun[]> => {
      const client = ensureSupabase();
      const { data, error } = await client
        .from("finance_feed_sync_runs" as never)
        .select("*")
        .eq("ngo_id" as never, ngoId as never)
        .order("created_at" as never, { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as unknown as FinanceFeedSyncRun[];
    },
  });

export const useFinancePaymentIntents = (ngoId?: string | null) =>
  useQuery({
    queryKey: ["finance-payment-intents", ngoId ?? "none"],
    enabled: !!supabase && !!ngoId,
    queryFn: async (): Promise<FinancePaymentIntent[]> => {
      const client = ensureSupabase();
      const { data, error } = await client
        .from("finance_payment_intents" as never)
        .select("*")
        .eq("ngo_id" as never, ngoId as never)
        .order("created_at" as never, { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []).map((row) => ({ ...row, amount: Number(row.amount) })) as unknown as FinancePaymentIntent[];
    },
  });

export const useFinanceIntegrationOutbox = (ngoId?: string | null, enabled = false) =>
  useQuery({
    queryKey: ["finance-integration-outbox", ngoId ?? "none"],
    enabled: !!supabase && !!ngoId && enabled,
    queryFn: async (): Promise<FinanceIntegrationOutboxItem[]> => {
      const client = ensureSupabase();
      const { data, error } = await client
        .from("finance_integration_outbox" as never)
        .select("*")
        .eq("ngo_id" as never, ngoId as never)
        .order("created_at" as never, { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as unknown as FinanceIntegrationOutboxItem[];
    },
  });

export const useSaveFinanceRecurringRule = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      header,
      template,
    }: {
      id?: string;
      header: Record<string, unknown>;
      template: FinanceRecurringRule["template_json"];
    }) => {
      const client = ensureSupabase();
      const { data, error } = await client.rpc("save_finance_recurring_rule" as never, {
        _rule_id: id ?? null,
        _header: header,
        _template: template,
      } as never);
      if (error) throw error;
      return data as unknown as FinanceRecurringRule;
    },
    onSuccess: () => {
      invalidateAutomation(queryClient);
      toast.success("Recurring rule saved");
    },
    onError: (error: Error) => toast.error(error.message),
  });
};

export const useGenerateFinanceRecurringDrafts = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (asOf: string) => {
      const client = ensureSupabase();
      const { data, error } = await client.rpc("generate_due_finance_recurring_drafts" as never, {
        _as_of: asOf,
      } as never);
      if (error) throw error;
      return (data ?? []) as unknown as FinanceRecurringOccurrence[];
    },
    onSuccess: (occurrences) => {
      invalidateAutomation(queryClient);
      toast.success(occurrences.length ? `${occurrences.length} recurring draft${occurrences.length === 1 ? "" : "s"} generated` : "No recurring entries are due");
    },
    onError: (error: Error) => toast.error(error.message),
  });
};

export const useQueueFinanceFeedSync = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ connectionId, from, through }: { connectionId: string; from?: string; through: string }) => {
      const client = ensureSupabase();
      const { data, error } = await client.rpc("queue_finance_feed_sync" as never, {
        _connection_id: connectionId,
        _from: from ?? null,
        _through: through,
      } as never);
      if (error) throw error;
      return data as unknown as FinanceFeedSyncRun;
    },
    onSuccess: () => {
      invalidateAutomation(queryClient);
      toast.success("Bank feed sync queued");
    },
    onError: (error: Error) => toast.error(error.message),
  });
};

export const useQueueFinancePaymentIntent = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ paymentId, provider, currency = "USD" }: { paymentId: string; provider: string; currency?: string }) => {
      const client = ensureSupabase();
      const { data, error } = await client.rpc("queue_finance_payment_intent" as never, {
        _payment_id: paymentId,
        _provider: provider.trim(),
        _currency: currency,
      } as never);
      if (error) throw error;
      return data as unknown as FinancePaymentIntent;
    },
    onSuccess: () => {
      invalidateAutomation(queryClient);
      void queryClient.invalidateQueries({ queryKey: ["finance-payment-intents"] });
      toast.success("Provider payment request queued safely");
    },
    onError: (error: Error) => toast.error(error.message),
  });
};
