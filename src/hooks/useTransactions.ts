import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { mapPostingError } from "@/lib/financePostingErrors";

export interface Transaction {
  id: string;
  ngo_id: string;
  fiscal_period_id: string | null;
  transaction_date: string;
  description: string;
  reference_number: string | null;
  is_void: boolean;
  status?: string;
  source_module?: string | null;
  transaction_number?: string | null;
  posted_at?: string | null;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface JournalEntryInput {
  account_id: string;
  debit: number;
  credit: number;
  memo?: string;
}

export interface PostTransactionInput {
  ngo_id: string;
  transaction_date: string;
  description: string;
  reference_number?: string | null;
  source_module?: string | null;
  fiscal_period_id?: string | null;
  entries: JournalEntryInput[];
  source_document_ids?: string[];
}

export interface SaveDraftTransactionInput extends PostTransactionInput {
  transaction_id?: string;
}

const journalLinesJson = (entries: JournalEntryInput[]) =>
  entries
    .filter((e) => e.account_id && (e.debit > 0 || e.credit > 0))
    .map((e) => ({
      account_id: e.account_id,
      debit: Number(e.debit) || 0,
      credit: Number(e.credit) || 0,
      memo: e.memo ?? null,
    }));

export function useTransactions(ngoId?: string, fiscalPeriodId?: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["transactions"] });
    queryClient.invalidateQueries({ queryKey: ["journal_entries"] });
    queryClient.invalidateQueries({ queryKey: ["trial_balance"] });
    queryClient.invalidateQueries({ queryKey: ["ledger"] });
  };

  const query = useQuery({
    queryKey: ["transactions", ngoId, fiscalPeriodId],
    enabled: !!ngoId,
    queryFn: async () => {
      let q = (supabase as any).from("transactions").select("*").eq("ngo_id", ngoId!).order("transaction_date", { ascending: false });
      if (fiscalPeriodId) q = q.eq("fiscal_period_id", fiscalPeriodId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as Transaction[];
    },
  });

  const create = useMutation({
    mutationFn: async (payload: {
      transaction: Omit<Transaction, "id" | "created_at" | "updated_at" | "is_void">;
      entries: JournalEntryInput[];
      source_document_ids?: string[];
    }) => {
      const { data, error } = await (supabase as any).rpc("post_transaction", {
        _ngo_id: payload.transaction.ngo_id,
        _transaction_date: payload.transaction.transaction_date,
        _description: payload.transaction.description,
        _reference_number: payload.transaction.reference_number ?? null,
        _source_module: payload.transaction.source_module ?? "manual",
        _fiscal_period_id: payload.transaction.fiscal_period_id ?? null,
        _journal_lines: journalLinesJson(payload.entries),
        _source_document_ids: payload.source_document_ids?.length
          ? payload.source_document_ids
          : null,
      });
      if (error) throw error;
      return data as Transaction;
    },
    onSuccess: invalidate,
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Could not post transaction", description: mapPostingError(error) });
    },
  });

  const saveDraft = useMutation({
    mutationFn: async (payload: SaveDraftTransactionInput) => {
      const { data, error } = await (supabase as any).rpc("save_draft_transaction", {
        _ngo_id: payload.ngo_id,
        _transaction_date: payload.transaction_date,
        _description: payload.description,
        _reference_number: payload.reference_number ?? null,
        _source_module: payload.source_module ?? "manual",
        _fiscal_period_id: payload.fiscal_period_id ?? null,
        _journal_lines: journalLinesJson(payload.entries),
        _transaction_id: payload.transaction_id ?? null,
      });
      if (error) throw error;
      return data as Transaction;
    },
    onSuccess: invalidate,
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Could not save draft", description: mapPostingError(error) });
    },
  });

  const postDraft = useMutation({
    mutationFn: async (transactionId: string) => {
      const { data, error } = await (supabase as any).rpc("post_draft_transaction", {
        _transaction_id: transactionId,
      });
      if (error) throw error;
      return data as Transaction;
    },
    onSuccess: invalidate,
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Could not post draft", description: mapPostingError(error) });
    },
  });

  const deleteDraft = useMutation({
    mutationFn: async (transactionId: string) => {
      const { error } = await (supabase as any).rpc("delete_draft_transaction", {
        _transaction_id: transactionId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Draft deleted" });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Could not delete draft", description: mapPostingError(error) });
    },
  });

  const voidTransaction = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const { data, error } = await (supabase as any).rpc("void_transaction", {
        _transaction_id: id,
        _reason: reason ?? null,
      });
      if (error) throw error;
      return data as Transaction;
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Transaction voided" });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Could not void transaction", description: mapPostingError(error) });
    },
  });

  const reverseTransaction = useMutation({
    mutationFn: async ({
      id,
      reversalDate,
      reason,
    }: {
      id: string;
      reversalDate: string;
      reason?: string;
    }) => {
      const { data, error } = await (supabase as any).rpc("reverse_transaction", {
        _transaction_id: id,
        _reversal_date: reversalDate,
        _reason: reason ?? null,
      });
      if (error) throw error;
      return data as Transaction;
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Reversal posted" });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Could not reverse transaction", description: mapPostingError(error) });
    },
  });

  return {
    ...query,
    create,
    saveDraft,
    postDraft,
    deleteDraft,
    voidTransaction,
    reverseTransaction,
  };
}
