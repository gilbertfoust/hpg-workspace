import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useFinanceNgoReview() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["finance-ngo-review"] });

  const accountRequests = useQuery({
    queryKey: ["finance-ngo-review", "account-requests"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("finance_ngo_account_requests")
        .select("*, ngos(legal_name,common_name), profiles!finance_ngo_account_requests_requested_by_user_id_fkey(full_name,email)")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const quarterSubmissions = useQuery({
    queryKey: ["finance-ngo-review", "quarters"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("finance_quarterly_submissions")
        .select("*, ngos(legal_name,common_name)")
        .order("period_end", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const reviewAccount = useMutation({
    mutationFn: async ({ id, decision, notes }: { id: string; decision: "approved" | "rejected"; notes?: string }) => {
      const { data, error } = await (supabase as any).rpc("review_finance_ngo_account_request", {
        p_request_id: id,
        p_decision: decision,
        p_review_notes: notes || null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => { invalidate(); toast.success("Account request reviewed"); },
    onError: (error: Error) => toast.error(error.message),
  });

  const reviewQuarter = useMutation({
    mutationFn: async ({ id, decision, notes }: { id: string; decision: string; notes?: string }) => {
      const { data, error } = await (supabase as any).rpc("review_finance_quarter", {
        p_submission_id: id,
        p_decision: decision,
        p_review_notes: notes || null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => { invalidate(); toast.success("Quarter review updated"); },
    onError: (error: Error) => toast.error(error.message),
  });

  return { accountRequests, quarterSubmissions, reviewAccount, reviewQuarter };
}
