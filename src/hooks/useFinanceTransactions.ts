import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSupabaseNotConfiguredError, supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { FinancePayment, FinancePaymentMethod } from "@/types/financeAccounting";

const RECEIPT_BUCKET = "ngo-documents";
const MAX_RECEIPT_BYTES = 15 * 1024 * 1024;

const ensureSupabase = () => {
  if (!supabase) throw getSupabaseNotConfiguredError();
  return supabase;
};

export interface FinanceExpenseTransactionInput {
  ngo_id: string;
  expense_account_id: string;
  payment_account_id: string;
  payment_method: FinancePaymentMethod;
  payment_date: string;
  amount: number;
  payee_name: string;
  memo?: string | null;
  reference_number?: string | null;
  fund_id?: string | null;
  receipt?: File | null;
  receipt_draft_id?: string | null;
}

export type FinanceReceiptDraftStatus = "queued" | "processing" | "ready" | "needs_review" | "failed" | "posted";

export interface FinanceReceiptDraft {
  id: string;
  ngo_id: string;
  document_id: string;
  content_sha256: string;
  status: FinanceReceiptDraftStatus;
  merchant_name: string | null;
  transaction_date: string | null;
  subtotal: number | null;
  tax_amount: number | null;
  tip_amount: number | null;
  total_amount: number | null;
  currency: string;
  payment_method: FinancePaymentMethod | null;
  reference_number: string | null;
  memo: string | null;
  suggested_expense_account_id: string | null;
  suggested_payment_account_id: string | null;
  confidence: number | null;
  needs_review_reasons: string[];
  extracted_data_json: Record<string, unknown>;
  error_message: string | null;
  posted_payment_id: string | null;
  created_at: string;
  updated_at: string;
  document?: {
    file_name: string;
    file_path: string;
    file_type: string | null;
  } | null;
}

interface ReceiptRegistrationResult {
  draft: FinanceReceiptDraft;
  is_duplicate: boolean;
}

const sanitizeFileName = (name: string) => name.replace(/[^a-zA-Z0-9._-]/g, "_");

const validateReceipt = (file: File) => {
  if (file.size <= 0 || file.size > MAX_RECEIPT_BYTES) {
    throw new Error("Receipt must be smaller than 15 MB.");
  }
  if (file.type !== "application/pdf" && !file.type.startsWith("image/")) {
    throw new Error("Receipt must be a PDF or image.");
  }
};

const fingerprintReceipt = async (file: File) => {
  if (!globalThis.crypto?.subtle) throw new Error("This browser cannot securely fingerprint receipts.");
  const digest = await globalThis.crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
};

const receiptStoragePath = (ngoId: string, file: File) => {
  const uniqueId = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `internal/finance/receipts/${ngoId}/${uniqueId}-${sanitizeFileName(file.name)}`;
};

export const useFinanceReceiptDrafts = (ngoId?: string | null) => useQuery({
  queryKey: ["finance-receipt-drafts", ngoId ?? "none"],
  enabled: !!supabase && !!ngoId,
  queryFn: async (): Promise<FinanceReceiptDraft[]> => {
    const client = ensureSupabase();
    const { data, error } = await client
      .from("finance_receipt_drafts" as never)
      .select("*, document:documents(file_name, file_path, file_type)")
      .eq("ngo_id" as never, ngoId as never)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    return ((data ?? []) as unknown as FinanceReceiptDraft[]).map((draft) => ({
      ...draft,
      subtotal: draft.subtotal === null ? null : Number(draft.subtotal),
      tax_amount: draft.tax_amount === null ? null : Number(draft.tax_amount),
      tip_amount: draft.tip_amount === null ? null : Number(draft.tip_amount),
      total_amount: draft.total_amount === null ? null : Number(draft.total_amount),
      confidence: draft.confidence === null ? null : Number(draft.confidence),
    }));
  },
});

export const useAnalyzeFinanceReceipt = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ ngoId, file }: { ngoId: string; file: File }): Promise<ReceiptRegistrationResult> => {
      const client = ensureSupabase();
      validateReceipt(file);
      const [contentSha256] = await Promise.all([fingerprintReceipt(file)]);
      const uploadedPath = receiptStoragePath(ngoId, file);

      const { error: uploadError } = await client.storage
        .from(RECEIPT_BUCKET)
        .upload(uploadedPath, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type || "application/octet-stream",
        });
      if (uploadError) throw uploadError;

      let registration: ReceiptRegistrationResult;
      try {
        const { data, error } = await client.rpc("register_finance_receipt_draft" as never, {
          _ngo_id: ngoId,
          _file_path: uploadedPath,
          _file_name: file.name,
          _file_type: file.type || "application/octet-stream",
          _file_size: file.size,
          _content_sha256: contentSha256,
        } as never);
        if (error) throw error;
        registration = data as unknown as ReceiptRegistrationResult;
      } catch (error) {
        await client.storage.from(RECEIPT_BUCKET).remove([uploadedPath]);
        throw error;
      }

      if (registration.is_duplicate) {
        await client.storage.from(RECEIPT_BUCKET).remove([uploadedPath]);
        return registration;
      }

      const { data, error } = await client.functions.invoke("extract-finance-receipt", {
        body: { draftId: registration.draft.id },
      });
      if (error) {
        const message = typeof data?.error === "string" ? data.error : error.message;
        throw new Error(message || "Receipt analysis failed");
      }
      if (!data?.draft) throw new Error("Receipt analysis did not return a draft");
      return { draft: data.draft as FinanceReceiptDraft, is_duplicate: false };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["finance-receipt-drafts"] });
      toast(result.is_duplicate ? {
        title: "Duplicate receipt found",
        description: "This exact receipt is already in the selected NGO’s receipt inbox.",
      } : {
        title: "Receipt analyzed",
        description: "The transaction draft is ready for review before posting.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Receipt analysis needs attention",
        description: error.message,
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["finance-receipt-drafts"] });
    },
  });
};

export const useRetryFinanceReceiptDraft = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (draftId: string): Promise<FinanceReceiptDraft> => {
      const client = ensureSupabase();
      const { data, error } = await client.functions.invoke("extract-finance-receipt", {
        body: { draftId },
      });
      if (error) throw new Error(typeof data?.error === "string" ? data.error : error.message);
      if (!data?.draft) throw new Error("Receipt analysis did not return a draft");
      return data.draft as FinanceReceiptDraft;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance-receipt-drafts"] });
      toast({ title: "Receipt reanalyzed", description: "Review the updated draft before posting." });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Receipt analysis failed", description: error.message });
    },
  });
};

export const useDismissFinanceReceiptDraft = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ draftId, reason }: { draftId: string; reason: string }) => {
      const client = ensureSupabase();
      const { error } = await client.rpc("dismiss_finance_receipt_draft" as never, {
        _receipt_draft_id: draftId,
        _reason: reason,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance-receipt-drafts"] });
      queryClient.invalidateQueries({ queryKey: ["finance-period-close-readiness"] });
      toast({ title: "Receipt draft dismissed", description: "The source document and dismissal reason remain in the audit record." });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Receipt draft not dismissed", description: error.message });
    },
  });
};

export const useFinanceExpenseTransactions = (ngoId?: string | null) => useQuery({
  queryKey: ["finance-expense-transactions", ngoId ?? "all"],
  enabled: !!supabase,
  queryFn: async (): Promise<FinancePayment[]> => {
    const client = ensureSupabase();
    let query = client
      .from("finance_payments" as never)
      .select("*")
      .eq("payment_type" as never, "reimbursement" as never)
      .order("payment_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (ngoId) query = query.eq("ngo_id" as never, ngoId as never);

    const { data, error } = await query;
    if (error) throw error;
    return ((data ?? []) as FinancePayment[]).map((transaction) => ({
      ...transaction,
      amount: Number(transaction.amount),
    }));
  },
});

export const usePostFinanceExpenseTransaction = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: FinanceExpenseTransactionInput): Promise<FinancePayment> => {
      const client = ensureSupabase();
      let uploadedPath: string | null = null;

      if (input.receipt_draft_id && input.receipt) {
        throw new Error("A receipt draft already includes its uploaded receipt.");
      }

      if (input.receipt_draft_id) {
        const { data, error } = await client.rpc("post_finance_receipt_draft" as never, {
          _receipt_draft_id: input.receipt_draft_id,
          _expense_account_id: input.expense_account_id,
          _payment_account_id: input.payment_account_id,
          _payment_method: input.payment_method,
          _payment_date: input.payment_date,
          _amount: input.amount,
          _payee_name: input.payee_name,
          _memo: input.memo?.trim() || null,
          _reference_number: input.reference_number?.trim() || null,
          _fund_id: input.fund_id || null,
        } as never);
        if (error) throw error;
        return data as FinancePayment;
      }

      if (input.receipt) {
        validateReceipt(input.receipt);
        uploadedPath = receiptStoragePath(input.ngo_id, input.receipt);

        const { error: uploadError } = await client.storage
          .from(RECEIPT_BUCKET)
          .upload(uploadedPath, input.receipt, {
            cacheControl: "3600",
            upsert: false,
            contentType: input.receipt.type || "application/octet-stream",
          });
        if (uploadError) throw uploadError;
      }

      try {
        const { data, error } = await client.rpc("create_and_post_finance_expense_transaction" as never, {
          _ngo_id: input.ngo_id,
          _expense_account_id: input.expense_account_id,
          _payment_account_id: input.payment_account_id,
          _payment_method: input.payment_method,
          _payment_date: input.payment_date,
          _amount: input.amount,
          _payee_name: input.payee_name,
          _memo: input.memo?.trim() || null,
          _reference_number: input.reference_number?.trim() || null,
          _document_id: null,
          _fund_id: input.fund_id || null,
          _receipt_file_path: uploadedPath,
          _receipt_file_name: input.receipt?.name ?? null,
          _receipt_file_type: input.receipt?.type ?? null,
          _receipt_file_size: input.receipt?.size ?? null,
        } as never);
        if (error) throw error;
        return data as FinancePayment;
      } catch (error) {
        if (uploadedPath) {
          await client.storage.from(RECEIPT_BUCKET).remove([uploadedPath]);
        }
        throw error;
      }
    },
    onSuccess: (transaction) => {
      queryClient.invalidateQueries({ queryKey: ["finance-expense-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["finance-payments"] });
      queryClient.invalidateQueries({ queryKey: ["finance-journal-entries"] });
      queryClient.invalidateQueries({ queryKey: ["finance-receipt-coverage"] });
      queryClient.invalidateQueries({ queryKey: ["finance-report"] });
      queryClient.invalidateQueries({ queryKey: ["finance-receipt-drafts"] });
      toast({
        title: "Transaction posted",
        description: `${transaction.payment_number} was balanced and added to the ledger.`,
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Transaction was not posted",
        description: error.message,
      });
    },
  });
};
