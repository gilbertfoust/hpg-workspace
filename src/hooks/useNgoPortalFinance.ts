import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface PortalFinanceAccount {
  id: string;
  code: string;
  name: string;
  account_type: "asset" | "liability" | "equity" | "revenue" | "expense";
  normal_balance: "debit" | "credit";
  is_cash_account: boolean;
  form_990_line?: string | null;
}

export interface PortalFinanceTransaction {
  id: string;
  payment_number: string;
  payment_date: string;
  payee_name: string;
  amount: number;
  payment_method: string;
  reference_number?: string | null;
  status: string;
  document_id?: string | null;
  journal_entry_id?: string | null;
}

export interface PortalQuarterSubmission {
  id: string;
  fiscal_year: number;
  quarter: number;
  status: string;
  no_activity: boolean;
  readiness_json: Record<string, unknown>;
  submitted_at?: string | null;
  review_notes?: string | null;
}

export function useNgoPortalFinance(ngoId?: string) {
  const queryClient = useQueryClient();
  const enabled = Boolean(ngoId);
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["ngo-portal-finance", ngoId] });
    queryClient.invalidateQueries({ queryKey: ["portal-documents"] });
  };

  const accounts = useQuery({
    queryKey: ["ngo-portal-finance", ngoId, "accounts"],
    enabled,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("ngo_portal_finance_account_catalog", { p_ngo_id: ngoId });
      if (error) throw error;
      return (data ?? []) as PortalFinanceAccount[];
    },
  });

  const transactions = useQuery({
    queryKey: ["ngo-portal-finance", ngoId, "transactions"],
    enabled,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("ngo_portal_recent_transactions", { p_ngo_id: ngoId, p_limit: 100 });
      if (error) throw error;
      return (data ?? []) as PortalFinanceTransaction[];
    },
  });

  const accountRequests = useQuery({
    queryKey: ["ngo-portal-finance", ngoId, "account-requests"],
    enabled,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("finance_ngo_account_requests")
        .select("*")
        .eq("ngo_id", ngoId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const quarters = useQuery({
    queryKey: ["ngo-portal-finance", ngoId, "quarters"],
    enabled,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("finance_quarterly_submissions")
        .select("*")
        .eq("ngo_id", ngoId)
        .order("fiscal_year", { ascending: false })
        .order("quarter", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PortalQuarterSubmission[];
    },
  });

  const postExpense = useMutation({
    mutationFn: async (input: {
      expenseAccountId: string;
      paymentAccountId: string;
      paymentMethod: string;
      paymentDate: string;
      amount: number;
      payeeName: string;
      memo?: string;
      referenceNumber?: string;
      documentId?: string;
    }) => {
      const { data, error } = await (supabase as any).rpc("create_and_post_ngo_portal_expense", {
        p_ngo_id: ngoId,
        p_expense_account_id: input.expenseAccountId,
        p_payment_account_id: input.paymentAccountId,
        p_payment_method: input.paymentMethod,
        p_payment_date: input.paymentDate,
        p_amount: input.amount,
        p_payee_name: input.payeeName,
        p_memo: input.memo || null,
        p_reference_number: input.referenceNumber || null,
        p_document_id: input.documentId || null,
        p_fund_id: null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => { invalidate(); toast.success("Transaction posted to the live ledger"); },
    onError: (error: Error) => toast.error(error.message),
  });

  const requestAccount = useMutation({
    mutationFn: async (input: { code: string; name: string; accountType: string; normalBalance: string; businessReason: string }) => {
      const { data, error } = await (supabase as any).rpc("request_finance_ngo_account", {
        p_ngo_id: ngoId,
        p_account_spec: {
          code: input.code,
          name: input.name,
          account_type: input.accountType,
          normal_balance: input.normalBalance,
        },
        p_business_reason: input.businessReason,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => { invalidate(); toast.success("Account sent to HPG Finance for approval"); },
    onError: (error: Error) => toast.error(error.message),
  });

  const prepareQuarter = useMutation({
    mutationFn: async ({ year, quarter, noActivity }: { year: number; quarter: number; noActivity: boolean }) => {
      const { data, error } = await (supabase as any).rpc("prepare_finance_quarter", {
        p_ngo_id: ngoId,
        p_fiscal_year: year,
        p_quarter: quarter,
        p_no_activity: noActivity,
      });
      if (error) throw error;
      return data as PortalQuarterSubmission;
    },
    onSuccess: () => { invalidate(); toast.success("Quarter readiness refreshed"); },
    onError: (error: Error) => toast.error(error.message),
  });

  const submitQuarter = useMutation({
    mutationFn: async (submissionId: string) => {
      const { data, error } = await (supabase as any).rpc("submit_finance_quarter", { p_submission_id: submissionId });
      if (error) throw error;
      return data as PortalQuarterSubmission;
    },
    onSuccess: () => { invalidate(); toast.success("Quarter submitted to HPG Finance"); },
    onError: (error: Error) => toast.error(error.message),
  });

  return { accounts, transactions, accountRequests, quarters, postExpense, requestAccount, prepareQuarter, submitQuarter };
}
