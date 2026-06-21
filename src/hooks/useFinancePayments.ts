import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSupabaseNotConfiguredError, supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import type { FinancePayment, FinancePaymentInput, FinancePaymentStatus } from "@/types/financeAccounting";

const ensureSupabase = () => {
  if (!supabase) throw getSupabaseNotConfiguredError();
};

export const useFinancePayments = (statusFilter?: FinancePaymentStatus | "all") => {
  return useQuery({
    queryKey: ["finance-payments", statusFilter ?? "all"],
    enabled: !!supabase,
    queryFn: async (): Promise<FinancePayment[]> => {
      ensureSupabase();
      let query = supabase.from("finance_payments" as never).select("*").order("payment_date", { ascending: false });
      if (statusFilter && statusFilter !== "all") {
        query = query.eq("status" as never, statusFilter as never);
      }
      const { data, error } = await query;
      if (error) throw error;
      if (!data?.length) return [];

      const ngoIds = [...new Set(data.map((p: FinancePayment) => p.ngo_id).filter(Boolean))] as string[];
      const billIds = [...new Set(data.map((p: FinancePayment) => p.bill_id).filter(Boolean))] as string[];

      const [{ data: ngos }, { data: bills }] = await Promise.all([
        ngoIds.length ? supabase.from("ngos").select("id, legal_name, common_name").in("id", ngoIds) : Promise.resolve({ data: [] }),
        billIds.length ? supabase.from("finance_bills" as never).select("id, bill_number, vendor_id").in("id" as never, billIds as never) : Promise.resolve({ data: [] }),
      ]);

      const ngoMap = new Map((ngos || []).map((n: { id: string }) => [n.id, n]));
      const billMap = new Map((bills || []).map((b: { id: string }) => [b.id, b]));

      return (data as FinancePayment[]).map((p) => ({
        ...p,
        amount: Number(p.amount),
        ngo: p.ngo_id ? ngoMap.get(p.ngo_id) ?? null : null,
        bill: p.bill_id ? billMap.get(p.bill_id) ?? null : null,
      }));
    },
  });
};

export const useSaveFinancePayment = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: FinancePaymentInput }) => {
      ensureSupabase();
      const payload = {
        payment_type: input.payment_type,
        payment_date: input.payment_date,
        amount: input.amount,
        bank_account_id: input.bank_account_id || null,
        target_bank_account_id: input.target_bank_account_id || null,
        bill_id: input.bill_id || null,
        payee_name: input.payee_name?.trim() || null,
        ngo_id: input.ngo_id || null,
        fund_id: input.fund_id || null,
        grant_application_id: input.grant_application_id || null,
        expense_account_id: input.expense_account_id || null,
        memo: input.memo?.trim() || null,
        document_id: input.document_id || null,
        approval_notes: input.approval_notes?.trim() || null,
      };

      if (id) {
        const { data, error } = await supabase.from("finance_payments" as never).update(payload as never).eq("id" as never, id as never).select().single();
        if (error) throw error;
        return data as FinancePayment;
      }

      const { data, error } = await supabase.from("finance_payments" as never).insert({
        ...payload,
        status: "draft",
        created_by_user_id: user?.id ?? null,
        payment_number: "",
      } as never).select().single();
      if (error) throw error;
      return data as FinancePayment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance-payments"] });
      toast({ title: "Payment saved" });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Could not save payment", description: error.message });
    },
  });
};

export const useSubmitFinancePayment = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      ensureSupabase();
      const { data, error } = await supabase.from("finance_payments" as never).update({ status: "pending_approval" } as never).eq("id" as never, id as never).eq("status" as never, "draft" as never).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance-payments"] });
      toast({ title: "Payment submitted for approval" });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Could not submit payment", description: error.message });
    },
  });
};

export const usePostFinancePayment = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      ensureSupabase();
      const { data, error } = await supabase.rpc("post_finance_payment" as never, { _payment_id: id } as never);
      if (error) throw error;
      return data as FinancePayment;
    },
    onSuccess: (p) => {
      queryClient.invalidateQueries({ queryKey: ["finance-payments"] });
      queryClient.invalidateQueries({ queryKey: ["finance-bills"] });
      queryClient.invalidateQueries({ queryKey: ["finance-journal-entries"] });
      queryClient.invalidateQueries({ queryKey: ["finance-bank-accounts"] });
      toast({ title: "Payment posted", description: p.payment_number });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Could not post payment", description: error.message });
    },
  });
};

export const useVoidFinancePayment = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      ensureSupabase();
      const { data, error } = await supabase.rpc("void_finance_payment" as never, { _payment_id: id, _reason: reason ?? null } as never);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance-payments"] });
      toast({ title: "Payment voided" });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Could not void payment", description: error.message });
    },
  });
};

export const useDeleteFinancePayment = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      ensureSupabase();
      const { error } = await supabase.from("finance_payments" as never).delete().eq("id" as never, id as never);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance-payments"] });
      toast({ title: "Draft payment deleted" });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Could not delete payment", description: error.message });
    },
  });
};
