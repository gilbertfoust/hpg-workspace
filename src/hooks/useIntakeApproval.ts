import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { mapPostingError } from "@/lib/financePostingErrors";

interface ApprovalPayload {
  intakeId: string;
  ngoId: string;
  fiscalPeriodId: string;
  description: string;
  transactionDate: string;
  referenceNumber?: string;
  lines: { accountId: string; debit: number; credit: number; memo?: string }[];
  reviewerNotes?: string;
}

export function useIntakeApproval() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: ApprovalPayload) => {
      const journalLines = payload.lines.map((line) => ({
        account_id: line.accountId,
        debit: line.debit,
        credit: line.credit,
        memo: line.memo ?? null,
      }));

      const { data: txn, error: txnErr } = await (supabase as any).rpc("post_transaction", {
        _ngo_id: payload.ngoId,
        _transaction_date: payload.transactionDate,
        _description: payload.description,
        _reference_number: payload.referenceNumber ?? null,
        _source_module: "document_intake",
        _fiscal_period_id: payload.fiscalPeriodId,
        _journal_lines: journalLines,
        _source_document_ids: null,
      });

      if (txnErr || !txn) {
        throw new Error(mapPostingError(txnErr ?? new Error("Failed to create transaction")));
      }

      const { error: linkErr } = await supabase
        .from("document_to_transaction_links" as any)
        .insert({
          intake_id: payload.intakeId,
          transaction_id: txn.id,
        } as any);

      if (linkErr) throw linkErr;

      const { error: updateErr } = await supabase
        .from("document_intake_submissions" as any)
        .update({
          status: "approved",
          fiscal_period_id: payload.fiscalPeriodId,
          reviewer_notes: payload.reviewerNotes || null,
        } as any)
        .eq("id", payload.intakeId);

      if (updateErr) throw updateErr;

      return txn;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document_intake_submissions"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["journal_entries"] });
      queryClient.invalidateQueries({ queryKey: ["document_to_transaction_links"] });
    },
  });
}
