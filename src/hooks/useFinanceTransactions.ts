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

      if (input.receipt) {
        validateReceipt(input.receipt);
        const uniqueId = typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        uploadedPath = `internal/finance/receipts/${input.ngo_id}/${uniqueId}-${sanitizeFileName(input.receipt.name)}`;

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
