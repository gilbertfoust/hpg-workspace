import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ensureSupabase, supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface FinanceAccessCapabilities {
  can_read: boolean;
  can_submit_requests: boolean;
  can_prepare_budgets: boolean;
  can_review: boolean;
  is_finance_staff: boolean;
}

export type FinanceExpenseRequestStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "rejected"
  | "paid"
  | "canceled";

export interface FinanceExpenseRequest {
  id: string;
  request_number: string;
  requester_user_id: string;
  department_id: string | null;
  ngo_id: string | null;
  payee_name: string;
  expense_date: string;
  amount: number;
  currency_code: string;
  category: string;
  business_purpose: string;
  description: string | null;
  receipt_document_id: string | null;
  budget_id: string | null;
  budget_account_id: string | null;
  work_item_id: string | null;
  status: FinanceExpenseRequestStatus;
  submitted_at: string | null;
  reviewed_by_user_id: string | null;
  reviewed_at: string | null;
  rejected_reason: string | null;
  paid_at: string | null;
  payment_reference: string | null;
  created_at: string;
  updated_at: string;
}

export interface FinanceExpenseRequestInput {
  payee_name: string;
  expense_date: string;
  amount: number;
  category: string;
  business_purpose: string;
  description?: string;
  ngo_id?: string;
  currency_code?: string;
  receipt_document_id?: string;
  budget_id?: string;
  budget_account_id?: string;
}

export interface FinanceWorkflowEvent {
  id: string;
  entity_type: "expense_request" | "purchase_request" | "budget";
  entity_id: string;
  work_item_id: string | null;
  event_type: "submitted" | "approved" | "rejected" | "paid";
  notification_type: "slack" | "email" | "in_app";
  notification_status: "queued" | "sent" | "skipped" | "failed";
  recipient: string | null;
  error_message: string | null;
  metadata_json: Record<string, unknown>;
  created_at: string;
  processed_at: string | null;
}

const invalidateFinanceOperations = (queryClient: ReturnType<typeof useQueryClient>) => {
  void queryClient.invalidateQueries({ queryKey: ["finance-expense-requests"] });
  void queryClient.invalidateQueries({ queryKey: ["finance-workflow-events"] });
  void queryClient.invalidateQueries({ queryKey: ["finance-hub-snapshot"] });
  void queryClient.invalidateQueries({ queryKey: ["purchase_requests"] });
  void queryClient.invalidateQueries({ queryKey: ["finance-budgets"] });
  void queryClient.invalidateQueries({ queryKey: ["work-items"] });
};

export const useFinanceAccessCapabilities = () =>
  useQuery({
    queryKey: ["finance-access-capabilities"],
    enabled: !!supabase,
    queryFn: async (): Promise<FinanceAccessCapabilities> => {
      const client = ensureSupabase();
      const { data, error } = await client.rpc("get_finance_access_capabilities" as never);
      if (error) throw error;
      return data as unknown as FinanceAccessCapabilities;
    },
  });

export const useFinanceExpenseRequests = () =>
  useQuery({
    queryKey: ["finance-expense-requests"],
    enabled: !!supabase,
    queryFn: async (): Promise<FinanceExpenseRequest[]> => {
      const client = ensureSupabase();
      const { data, error } = await client
        .from("finance_expense_requests" as never)
        .select("*")
        .order("created_at" as never, { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as FinanceExpenseRequest[];
    },
  });

export const useFinanceWorkflowEvents = (limit = 50) =>
  useQuery({
    queryKey: ["finance-workflow-events", limit],
    enabled: !!supabase,
    queryFn: async (): Promise<FinanceWorkflowEvent[]> => {
      const client = ensureSupabase();
      const { data, error } = await client
        .from("finance_workflow_events" as never)
        .select("*")
        .order("created_at" as never, { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as unknown as FinanceWorkflowEvent[];
    },
  });

export const useSaveFinanceExpenseRequest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: FinanceExpenseRequestInput }) => {
      const client = ensureSupabase();
      const { data, error } = await client.rpc("save_finance_expense_request" as never, {
        _request_id: id ?? null,
        _payload: input,
      } as never);
      if (error) throw error;
      return data as unknown as FinanceExpenseRequest;
    },
    onSuccess: () => {
      invalidateFinanceOperations(queryClient);
      toast.success("Expense request saved");
    },
    onError: (error: Error) => toast.error(error.message),
  });
};

export const useSubmitFinanceExpenseRequest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (requestId: string) => {
      const client = ensureSupabase();
      const { data, error } = await client.rpc("submit_finance_expense_request" as never, {
        _request_id: requestId,
      } as never);
      if (error) throw error;
      return data as unknown as FinanceExpenseRequest;
    },
    onSuccess: () => {
      invalidateFinanceOperations(queryClient);
      toast.success("Expense request submitted to Finance");
    },
    onError: (error: Error) => toast.error(error.message),
  });
};

export const useReviewFinanceExpenseRequest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, decision, reason }: { id: string; decision: "approved" | "rejected"; reason?: string }) => {
      const client = ensureSupabase();
      const { data, error } = await client.rpc("review_finance_expense_request" as never, {
        _request_id: id,
        _decision: decision,
        _reason: reason ?? null,
      } as never);
      if (error) throw error;
      return data as unknown as FinanceExpenseRequest;
    },
    onSuccess: (_, variables) => {
      invalidateFinanceOperations(queryClient);
      toast.success(`Expense request ${variables.decision}`);
    },
    onError: (error: Error) => toast.error(error.message),
  });
};

export const useMarkFinanceExpensePaid = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, paymentReference }: { id: string; paymentReference: string }) => {
      const client = ensureSupabase();
      const { data, error } = await client.rpc("mark_finance_expense_request_paid" as never, {
        _request_id: id,
        _payment_reference: paymentReference,
      } as never);
      if (error) throw error;
      return data as unknown as FinanceExpenseRequest;
    },
    onSuccess: () => {
      invalidateFinanceOperations(queryClient);
      toast.success("Expense request marked paid");
    },
    onError: (error: Error) => toast.error(error.message),
  });
};
