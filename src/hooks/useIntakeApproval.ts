import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
      // 1. Check period is not locked
      const { data: period } = await supabase
        .from("fiscal_periods")
        .select("is_locked")
        .eq("id", payload.fiscalPeriodId)
        .single();

      if (period?.is_locked) {
        throw new Error("Cannot approve: fiscal period is locked.");
      }

      // 2. Create the transaction
      const { data: txn, error: txnErr } = await supabase
        .from("transactions")
        .insert({
          ngo_id: payload.ngoId,
          fiscal_period_id: payload.fiscalPeriodId,
          description: payload.description,
          transaction_date: payload.transactionDate,
          reference_number: payload.referenceNumber || null,
        })
        .select()
        .single();

      if (txnErr || !txn) throw txnErr || new Error("Failed to create transaction");

      // 3. Create journal entries
      const entries = payload.lines.map((line) => ({
        transaction_id: txn.id,
        account_id: line.accountId,
        debit: line.debit,
        credit: line.credit,
        memo: line.memo || null,
      }));

      const { error: jeErr } = await supabase
        .from("journal_entries")
        .insert(entries);

      if (jeErr) throw jeErr;

      // 4. Link intake to transaction
      const { error: linkErr } = await supabase
        .from("document_to_transaction_links" as any)
        .insert({
          intake_id: payload.intakeId,
          transaction_id: txn.id,
        } as any);

      if (linkErr) throw linkErr;

      // 5. Update intake status to approved
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
