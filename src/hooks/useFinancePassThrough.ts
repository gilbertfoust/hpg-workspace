import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSupabaseNotConfiguredError, supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

export interface FinancePassThroughRequest {
  id: string;
  request_number: string;
  deposit_id: string | null;
  ngo_id: string;
  fund_id: string | null;
  requested_amount: number;
  admin_fee_amount: number;
  net_disbursement_amount: number;
  restriction_type: string | null;
  restriction_notes: string | null;
  status: string;
  memo: string | null;
  approved_at: string | null;
  created_at: string;
}

export interface NgoSubledgerBalance {
  ngo_id: string;
  as_of_date: string;
  unrestricted_balance: number;
  restricted_balance: number;
  pass_through_balance: number;
  total_balance: number;
}

const ensureSupabase = () => {
  if (!supabase) throw getSupabaseNotConfiguredError();
};

export const useFinancePassThroughRequests = () =>
  useQuery({
    queryKey: ["finance-pass-through-requests"],
    enabled: !!supabase,
    queryFn: async (): Promise<FinancePassThroughRequest[]> => {
      ensureSupabase();
      const { data, error } = await supabase
        .from("finance_pass_through_requests" as never)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []).map((r: FinancePassThroughRequest) => ({
        ...r,
        requested_amount: Number(r.requested_amount),
        admin_fee_amount: Number(r.admin_fee_amount),
        net_disbursement_amount: Number(r.net_disbursement_amount),
      }));
    },
  });

export const useCreateFinancePassThroughRequest = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (input: {
      ngo_id: string;
      requested_amount: number;
      deposit_id?: string | null;
      fund_id?: string | null;
      restriction_type?: string | null;
      restriction_notes?: string | null;
      memo?: string | null;
    }) => {
      ensureSupabase();
      const { data, error } = await supabase.rpc("create_finance_pass_through_request" as never, {
        _ngo_id: input.ngo_id,
        _requested_amount: input.requested_amount,
        _deposit_id: input.deposit_id ?? null,
        _fund_id: input.fund_id ?? null,
        _restriction_type: input.restriction_type ?? null,
        _restriction_notes: input.restriction_notes ?? null,
        _memo: input.memo ?? null,
      } as never);
      if (error) throw error;
      return data as FinancePassThroughRequest;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["finance-pass-through-requests"] });
      toast({ title: "Pass-through request created" });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Error", description: e.message }),
  });
};

export const useApproveFinancePassThroughRequest = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ requestId, adminFeeAmount }: { requestId: string; adminFeeAmount?: number }) => {
      ensureSupabase();
      const { data, error } = await supabase.rpc("approve_finance_pass_through_request" as never, {
        _request_id: requestId,
        _admin_fee_amount: adminFeeAmount ?? null,
      } as never);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["finance-pass-through-requests"] });
      toast({ title: "Request approved" });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Error", description: e.message }),
  });
};

export const useNgoSubledgerBalance = (ngoId?: string, asOfDate?: string) =>
  useQuery({
    queryKey: ["finance-ngo-subledger", ngoId, asOfDate],
    enabled: !!supabase && !!ngoId,
    queryFn: async (): Promise<NgoSubledgerBalance> => {
      ensureSupabase();
      const { data, error } = await supabase.rpc("finance_ngo_subledger_balance" as never, {
        _ngo_id: ngoId,
        _as_of_date: asOfDate ?? new Date().toISOString().slice(0, 10),
      } as never);
      if (error) throw error;
      const row = data as NgoSubledgerBalance;
      return {
        ...row,
        unrestricted_balance: Number(row.unrestricted_balance),
        restricted_balance: Number(row.restricted_balance),
        pass_through_balance: Number(row.pass_through_balance),
        total_balance: Number(row.total_balance),
      };
    },
  });

export const useFinanceRestrictedFundReleases = () =>
  useQuery({
    queryKey: ["finance-restricted-fund-releases"],
    enabled: !!supabase,
    queryFn: async () => {
      ensureSupabase();
      const { data, error } = await supabase
        .from("finance_restricted_fund_releases" as never)
        .select("*")
        .order("release_date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

export const useCreateRestrictedFundRelease = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: {
      fund_id: string;
      amount: number;
      release_date: string;
      from_restriction_class: string;
      memo?: string | null;
      ngo_id?: string | null;
    }) => {
      ensureSupabase();
      const releaseNumber = `RFR-${new Date().getFullYear()}-${Date.now().toString().slice(-5)}`;
      const { data, error } = await supabase
        .from("finance_restricted_fund_releases" as never)
        .insert({
          release_number: releaseNumber,
          fund_id: input.fund_id,
          ngo_id: input.ngo_id ?? null,
          release_date: input.release_date,
          amount: input.amount,
          from_restriction_class: input.from_restriction_class,
          memo: input.memo ?? null,
          created_by_user_id: user?.id ?? null,
        } as never)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["finance-restricted-fund-releases"] });
      toast({ title: "Restricted fund release recorded" });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Error", description: e.message }),
  });
};
