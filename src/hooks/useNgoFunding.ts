import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useNgoFunding(ngoId?: string | null) {
  const queryClient = useQueryClient();
  const enabled = Boolean(ngoId);
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["ngo-funding", ngoId] });

  const connections = useQuery({
    queryKey: ["ngo-funding", ngoId, "connections"], enabled,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("ngo_bank_connections").select("*").eq("ngo_id", ngoId).order("created_at", { ascending: false });
      if (error) throw error; return data ?? [];
    },
  });
  const disbursements = useQuery({
    queryKey: ["ngo-funding", ngoId, "disbursements"], enabled,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("ngo_fund_disbursements").select("*, ngo_disbursement_approvals(*)").eq("ngo_id", ngoId).order("created_at", { ascending: false });
      if (error) throw error; return data ?? [];
    },
  });
  const create = useMutation({
    mutationFn: async (input: any) => {
      const { data, error } = await (supabase as any).rpc("request_ngo_disbursement", {
        p_ngo_id: ngoId,
        p_bank_connection_id: input.bankConnectionId,
        p_source_cash_account_id: input.sourceCashAccountId,
        p_distribution_account_id: input.distributionAccountId,
        p_amount: Number(input.amount),
        p_source_currency: input.sourceCurrency,
        p_destination_currency: input.destinationCurrency,
        p_purpose: input.purpose,
        p_memo: input.memo || null,
      });
      if (error) throw error; return data;
    },
    onSuccess: () => { invalidate(); toast.success("Funding request created for approval"); },
    onError: (error: Error) => toast.error(error.message),
  });
  const approve = useMutation({
    mutationFn: async ({ id, decision, notes }: { id: string; decision: string; notes?: string }) => {
      const { data, error } = await (supabase as any).rpc("approve_ngo_disbursement", { p_disbursement_id: id, p_decision: decision, p_notes: notes || null });
      if (error) throw error; return data;
    },
    onSuccess: () => { invalidate(); toast.success("Funding approval recorded"); },
    onError: (error: Error) => toast.error(error.message),
  });
  const queue = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await (supabase as any).rpc("queue_ngo_disbursement", { p_disbursement_id: id });
      if (error) throw error; return data;
    },
    onSuccess: () => { invalidate(); toast.success("Funding queued for provider release"); },
    onError: (error: Error) => toast.error(error.message),
  });
  const process = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.functions.invoke("process-ngo-disbursement", { body: { disbursementId: id } });
      if (error) throw error; if (data?.error) throw new Error(data.error); return data;
    },
    onSuccess: () => { invalidate(); toast.success("Funding sent to the payout provider"); },
    onError: (error: Error) => toast.error(error.message),
  });
  const verifyConnection = useMutation({
    mutationFn: async ({ id, recipientRef }: { id: string; recipientRef: string }) => {
      const { data, error } = await (supabase as any).rpc("verify_ngo_bank_connection", { p_connection_id: id, p_provider_recipient_ref: recipientRef, p_capabilities: { payouts: true } });
      if (error) throw error; return data;
    },
    onSuccess: () => { invalidate(); toast.success("Payout account verified"); },
    onError: (error: Error) => toast.error(error.message),
  });
  const completeManual = useMutation({
    mutationFn: async ({ id, documentId, reference, paidDate }: { id: string; documentId: string; reference: string; paidDate: string }) => {
      const { data, error } = await (supabase as any).rpc("complete_manual_ngo_disbursement", { p_disbursement_id: id, p_receipt_document_id: documentId, p_provider_reference: reference, p_paid_date: paidDate });
      if (error) throw error; return data;
    },
    onSuccess: () => { invalidate(); toast.success("Relay receipt archived and funding posted to the ledger"); },
    onError: (error: Error) => toast.error(error.message),
  });
  return { connections, disbursements, create, approve, queue, process, verifyConnection, completeManual };
}
